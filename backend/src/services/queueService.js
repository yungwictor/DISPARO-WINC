import { db } from "../config/db.js";
import { readSettings } from "../config/db.js";
import { randomInt, sleep } from "../utils/async.js";
import { renderTemplate } from "../utils/template.js";
import { sendMessage } from "./whatsappService.js";
import { emitToCampaign, emit } from "./socketService.js";

const runningJobs = new Map();

function getCampaign(id) {
  return db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
}

function getMetrics(campaignId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;

  const statuses = db.prepare(`
    SELECT status, COUNT(*) AS total
    FROM campaign_recipients
    WHERE campaign_id = ?
    GROUP BY status
  `).all(campaignId);

  const totals = statuses.reduce(
    (acc, row) => ({ ...acc, [row.status]: row.total }),
    { pending: 0, processing: 0, sent: 0, failed: 0, cancelled: 0, opted_out: 0 }
  );

  return {
    ...campaign,
    sent: totals.sent,
    failed: totals.failed,
    pending: totals.pending + totals.processing,
    cancelled: totals.cancelled,
    optedOut: totals.opted_out,
    progress: campaign.total ? Math.round((totals.sent + totals.failed + totals.cancelled + totals.opted_out) / campaign.total * 100) : 0
  };
}

function log(campaignId, level, message, payload = null) {
  const row = db.prepare(`
    INSERT INTO campaign_logs (campaign_id, level, message, payload)
    VALUES (?, ?, ?, ?)
  `).run(campaignId, level, message, payload ? JSON.stringify(payload) : null);

  const logEntry = {
    id: row.lastInsertRowid,
    campaign_id: campaignId,
    level,
    message,
    payload,
    created_at: new Date().toISOString()
  };

  emitToCampaign(campaignId, "campaign:log", logEntry);
  return logEntry;
}

function syncCampaignCounters(campaignId, status = null) {
  const metrics = getMetrics(campaignId);
  if (!metrics) return null;

  db.prepare(`
    UPDATE campaigns
    SET sent = ?, failed = ?, pending = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(metrics.sent, metrics.failed, metrics.pending, status, campaignId);

  const updated = getMetrics(campaignId);
  emitToCampaign(campaignId, "campaign:progress", updated);
  emit("stats:refresh", buildStats());
  return updated;
}

function isInsideQuietHours(settings) {
  if (!settings.safeMode) return false;
  const now = new Date();
  const current = now.toTimeString().slice(0, 5);
  const start = settings.quietHoursStart || "22:00";
  const end = settings.quietHoursEnd || "08:00";

  if (start < end) {
    return current >= start && current <= end;
  }

  return current >= start || current <= end;
}

async function runCampaign(campaignId, control) {
  let campaign = getCampaign(campaignId);
  const settings = readSettings();

  if (!campaign) return;

  log(campaignId, "info", `Campanha "${campaign.name}" iniciada.`);

  try {
    while (!control.cancelled) {
      while (control.paused && !control.cancelled) {
        syncCampaignCounters(campaignId, "paused");
        await sleep(600);
      }

      campaign = getCampaign(campaignId);
      if (!campaign || control.cancelled) break;

      const next = db.prepare(`
        SELECT * FROM campaign_recipients
        WHERE campaign_id = ? AND status = 'pending'
          AND attempt_count < 3
          AND NOT EXISTS (
            SELECT 1 FROM opt_outs WHERE opt_outs.phone = campaign_recipients.phone
          )
          AND NOT EXISTS (
            SELECT 1 FROM contacts
             WHERE contacts.phone = campaign_recipients.phone
               AND contacts.consent_status = 'opt_out'
          )
        ORDER BY id ASC
        LIMIT 1
      `).get(campaignId);

      if (!next) break;

      if (campaign.safe_mode && isInsideQuietHours(settings)) {
        log(campaignId, "warn", "Modo seguro segurou o envio por janela silenciosa configurada.");
        await sleep(1500);
        continue;
      }

      const delay = randomInt(campaign.delay_min, campaign.delay_max);
      db.prepare("UPDATE campaign_recipients SET status = 'processing', attempt_count = attempt_count + 1 WHERE id = ? AND status = 'pending'").run(next.id);
      syncCampaignCounters(campaignId, "running");
      log(campaignId, "info", `Aguardando ${delay}s antes de enviar para ${next.phone}.`);
      await sleep(delay * 1000);

      if (control.cancelled) break;

      const rendered = renderTemplate(campaign.message, next);
      const attachments = JSON.parse(campaign.attachments || "[]");
      const result = await sendMessage({
        provider: campaign.provider,
        phone: next.phone,
        message: rendered,
        attachments,
        safeMode: Boolean(campaign.safe_mode),
        idempotencyKey: next.delivery_key
      });

      if (result.ok) {
        db.prepare(`
          UPDATE campaign_recipients
          SET status = 'sent', last_error = NULL, sent_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(next.id);
        log(campaignId, "success", `Mensagem enviada para ${next.phone}.`, result);
      } else {
        db.prepare(`
          UPDATE campaign_recipients
          SET status = 'failed', last_error = ?
          WHERE id = ?
        `).run(result.error || "Falha desconhecida", next.id);
        log(campaignId, "error", `Falha ao enviar para ${next.phone}: ${result.error || "erro desconhecido"}.`);
      }

      syncCampaignCounters(campaignId, "running");
    }

    if (control.cancelled) {
      db.prepare(`
        UPDATE campaign_recipients
        SET status = 'cancelled'
        WHERE campaign_id = ? AND status IN ('pending', 'processing')
      `).run(campaignId);
      syncCampaignCounters(campaignId, "cancelled");
      log(campaignId, "warn", "Campanha cancelada pelo operador.");
      return;
    }

    syncCampaignCounters(campaignId, "completed");
    db.prepare("UPDATE campaigns SET completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
    log(campaignId, "success", "Campanha finalizada.");
  } catch (error) {
    syncCampaignCounters(campaignId, "failed");
    log(campaignId, "error", `Erro interno da fila: ${error.message}`);
  } finally {
    runningJobs.delete(campaignId);
  }
}

export function startCampaign(campaignId) {
  const id = Number(campaignId);
  const campaign = getCampaign(id);

  if (!campaign) {
    const error = new Error("Campanha nao encontrada");
    error.status = 404;
    throw error;
  }

  if (runningJobs.has(id)) {
    return getMetrics(id);
  }

  db.prepare(`
    UPDATE campaigns
    SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  const control = { paused: false, cancelled: false };
  runningJobs.set(id, control);
  runCampaign(id, control);

  return syncCampaignCounters(id, "running");
}

export function recoverInterruptedCampaigns() {
  const recover = db.transaction(() => {
    const recipients = db.prepare(`
      UPDATE campaign_recipients
         SET status = 'pending', last_error = 'Recuperado apos interrupcao'
       WHERE status = 'processing' AND attempt_count < 3
    `).run();
    const campaigns = db.prepare(`
      UPDATE campaigns
         SET status = 'paused', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'running'
    `).run();
    return { recipients: recipients.changes, campaigns: campaigns.changes };
  });
  return recover();
}

export function isRecipientOptedOut(phone) {
  return Boolean(
    db.prepare(`
      SELECT 1 FROM opt_outs WHERE phone = ?
      UNION
      SELECT 1 FROM contacts WHERE phone = ? AND consent_status = 'opt_out'
      LIMIT 1
    `).get(phone, phone)
  );
}

export function pauseCampaign(campaignId) {
  const id = Number(campaignId);
  const control = runningJobs.get(id);
  if (control) control.paused = true;
  db.prepare("UPDATE campaigns SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  log(id, "warn", "Campanha pausada.");
  return syncCampaignCounters(id, "paused");
}

export function resumeCampaign(campaignId) {
  const id = Number(campaignId);
  const control = runningJobs.get(id);
  if (control) {
    control.paused = false;
  } else {
    db.prepare(`
      UPDATE campaign_recipients
         SET status = 'pending', last_error = NULL
       WHERE campaign_id = ? AND status IN ('failed', 'processing') AND attempt_count < 3
    `).run(id);
    return startCampaign(id);
  }
  db.prepare("UPDATE campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  log(id, "info", "Campanha continuada.");
  return syncCampaignCounters(id, "running");
}

export function cancelCampaign(campaignId) {
  const id = Number(campaignId);
  const control = runningJobs.get(id);
  if (control) control.cancelled = true;
  db.prepare("UPDATE campaigns SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  log(id, "warn", "Cancelamento solicitado.");
  return syncCampaignCounters(id, "cancelled");
}

export function buildStats() {
  const campaignStats = db.prepare(`
    SELECT
      COUNT(*) AS campaigns,
      COALESCE(SUM(sent), 0) AS sent,
      COALESCE(SUM(failed), 0) AS failed,
      COALESCE(SUM(pending), 0) AS pending
    FROM campaigns
  `).get();

  const contacts = db.prepare("SELECT COUNT(*) AS total FROM contacts").get().total;
  const session = db.prepare("SELECT provider, status, phone FROM whatsapp_sessions ORDER BY id ASC LIMIT 1").get();
  const recent = db.prepare(`
    SELECT id, name, status, total, sent, failed, pending, created_at
    FROM campaigns
    ORDER BY id DESC
    LIMIT 6
  `).all();

  return { ...campaignStats, contacts, session, recent };
}

export function getCampaignWithRecipients(campaignId) {
  const campaign = getMetrics(Number(campaignId));
  if (!campaign) return null;
  const recipients = db.prepare(`
    SELECT id, phone, name, status, last_error, sent_at
    FROM campaign_recipients
    WHERE campaign_id = ?
    ORDER BY id ASC
  `).all(campaignId);
  const logs = db.prepare(`
    SELECT id, level, message, payload, created_at
    FROM campaign_logs
    WHERE campaign_id = ?
    ORDER BY id DESC
    LIMIT 80
  `).all(campaignId);

  return { ...campaign, recipients, logs };
}
