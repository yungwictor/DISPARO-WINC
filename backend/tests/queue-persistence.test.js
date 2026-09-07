import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "disparo-winc-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = join(directory, "queue.sqlite");
process.env.ADMIN_PASSWORD = "test-password-not-for-production";
process.env.JWT_SECRET = "test-secret-that-is-long-enough";

const { db } = await import("../src/config/db.js");
const { applyOptOuts, isRecipientOptedOut, recoverInterruptedCampaigns } = await import("../src/services/queueService.js");

function seedCampaign() {
  const userId = db.prepare("SELECT id FROM users LIMIT 1").get().id;
  const campaign = db.prepare(`
    INSERT INTO campaigns (user_id, name, message, total, pending, status)
    VALUES (?, 'Recovery test', 'Hello', 2, 2, 'running')
  `).run(userId);
  const insert = db.prepare(`
    INSERT INTO campaign_recipients
      (campaign_id, phone, status, attempt_count, delivery_key)
    VALUES (?, ?, ?, ?, ?)
  `);
  insert.run(campaign.lastInsertRowid, "5511990000001", "processing", 1, "delivery-recovery-1");
  insert.run(campaign.lastInsertRowid, "5511990000002", "sent", 1, "delivery-recovery-2");
  return Number(campaign.lastInsertRowid);
}

test("persists queue state and recovers interrupted work as paused", () => {
  const campaignId = seedCampaign();
  const result = recoverInterruptedCampaigns();
  assert.equal(result.recipients, 1);
  assert.equal(result.campaigns, 1);
  assert.equal(db.prepare("SELECT status FROM campaigns WHERE id = ?").get(campaignId).status, "paused");
  assert.equal(
    db.prepare("SELECT status FROM campaign_recipients WHERE delivery_key = ?").get("delivery-recovery-1").status,
    "pending"
  );
  assert.equal(
    db.prepare("SELECT status FROM campaign_recipients WHERE delivery_key = ?").get("delivery-recovery-2").status,
    "sent"
  );
});

test("prevents duplicate recipients and delivery keys", () => {
  const campaignId = db.prepare("SELECT id FROM campaigns LIMIT 1").get().id;
  assert.throws(
    () =>
      db.prepare(`
        INSERT INTO campaign_recipients
          (campaign_id, phone, status, delivery_key)
        VALUES (?, '5511990000001', 'pending', 'another-key')
      `).run(campaignId),
    /UNIQUE/
  );
  assert.throws(
    () =>
      db.prepare(`
        INSERT INTO campaign_recipients
          (campaign_id, phone, status, delivery_key)
        VALUES (?, '5511990000099', 'pending', 'delivery-recovery-1')
      `).run(campaignId),
    /UNIQUE/
  );
});

test("honors permanent and contact-level opt-out records", () => {
  db.prepare("INSERT INTO opt_outs (phone, reason) VALUES (?, ?)").run("5511988888888", "request");
  assert.equal(isRecipientOptedOut("5511988888888"), true);
  assert.equal(isRecipientOptedOut("5511977777777"), false);

  const campaignId = db.prepare("SELECT id FROM campaigns LIMIT 1").get().id;
  db.prepare(`
    INSERT INTO campaign_recipients (campaign_id, phone, status, delivery_key)
    VALUES (?, '5511988888888', 'pending', 'delivery-opt-out')
  `).run(campaignId);
  assert.equal(applyOptOuts(campaignId), 1);
  assert.equal(
    db.prepare("SELECT status FROM campaign_recipients WHERE delivery_key = 'delivery-opt-out'").get().status,
    "opted_out"
  );
});

test.after(() => db.close());
