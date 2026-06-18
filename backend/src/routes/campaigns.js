import { Router } from "express";
import { db } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dedupeRecipients, normalizePhone, parseRecipientsFromText } from "../utils/phone.js";
import { cancelCampaign, getCampaignWithRecipients, pauseCampaign, resumeCampaign, startCampaign } from "../services/queueService.js";

export const campaignsRouter = Router();

campaignsRouter.use(requireAuth);

campaignsRouter.get("/", (req, res) => {
  const campaigns = db.prepare(`
    SELECT id, name, status, provider, total, sent, failed, pending, safe_mode, warmup_mode, created_at, updated_at
    FROM campaigns
    ORDER BY id DESC
    LIMIT 100
  `).all();

  res.json({ campaigns });
});

campaignsRouter.post("/", (req, res) => {
  const body = req.body || {};
  const incoming = Array.isArray(body.recipients)
    ? body.recipients
    : parseRecipientsFromText(body.numbers || "");
  const { valid, invalid, duplicates } = dedupeRecipients(incoming);

  if (!body.message || !String(body.message).trim()) {
    return res.status(422).json({ message: "Mensagem obrigatoria" });
  }

  if (!valid.length) {
    return res.status(422).json({ message: "Nenhum numero valido para campanha", invalid, duplicates });
  }

  const create = db.transaction(() => {
    const campaign = db.prepare(`
      INSERT INTO campaigns (
        user_id, name, message, provider, delay_min, delay_max, safe_mode, warmup_mode,
        attachments, total, pending, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
      req.user.id,
      body.name || `Campanha ${new Date().toLocaleString("pt-BR")}`,
      String(body.message).trim(),
      body.provider === "official" ? "official" : "wppconnect",
      Math.max(1, Number(body.delayMin || 8)),
      Math.max(1, Number(body.delayMax || 22)),
      body.safeMode === false ? 0 : 1,
      body.warmupMode ? 1 : 0,
      JSON.stringify(body.attachments || []),
      valid.length,
      valid.length
    );

    const insertRecipient = db.prepare(`
      INSERT INTO campaign_recipients (campaign_id, phone, name, field1, field2, vencimento, plano)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of valid) {
      insertRecipient.run(
        campaign.lastInsertRowid,
        normalizePhone(item.phone),
        item.name || item.nome || "",
        item.field1 || item.campo1 || "",
        item.field2 || item.campo2 || "",
        item.vencimento || "",
        item.plano || ""
      );
    }

    return campaign.lastInsertRowid;
  });

  const id = create();
  res.status(201).json({ campaign: getCampaignWithRecipients(id), invalid, duplicates });
});

campaignsRouter.get("/:id", (req, res) => {
  const campaign = getCampaignWithRecipients(req.params.id);
  if (!campaign) return res.status(404).json({ message: "Campanha nao encontrada" });
  res.json({ campaign });
});

campaignsRouter.post("/:id/start", (req, res, next) => {
  try {
    res.json({ campaign: startCampaign(req.params.id) });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/:id/pause", (req, res) => {
  res.json({ campaign: pauseCampaign(req.params.id) });
});

campaignsRouter.post("/:id/resume", (req, res) => {
  res.json({ campaign: resumeCampaign(req.params.id) });
});

campaignsRouter.post("/:id/cancel", (req, res) => {
  res.json({ campaign: cancelCampaign(req.params.id) });
});
