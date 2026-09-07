import { Router } from "express";
import { db } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { dedupeRecipients, normalizePhone, parseRecipientsFromText } from "../utils/phone.js";

export const contactsRouter = Router();

contactsRouter.use(requireAuth);

contactsRouter.get("/", (req, res) => {
  const contacts = db.prepare("SELECT * FROM contacts ORDER BY id DESC LIMIT 500").all();
  res.json({ contacts });
});

contactsRouter.post("/validate", (req, res) => {
  const incoming = Array.isArray(req.body.recipients)
    ? req.body.recipients
    : parseRecipientsFromText(req.body.text || "");
  const result = dedupeRecipients(incoming);
  res.json(result);
});

contactsRouter.post("/import", (req, res) => {
  const incoming = Array.isArray(req.body.contacts)
    ? req.body.contacts
    : parseRecipientsFromText(req.body.text || "");
  const { valid, invalid, duplicates } = dedupeRecipients(incoming);

  const insert = db.prepare(`
    INSERT INTO contacts (name, phone, field1, field2, vencimento, plano, source, consent_status)
    VALUES (@name, @phone, @field1, @field2, @vencimento, @plano, @source, @consent_status)
    ON CONFLICT(phone) DO UPDATE SET
      name = excluded.name,
      field1 = excluded.field1,
      field2 = excluded.field2,
      vencimento = excluded.vencimento,
      plano = excluded.plano
  `);

  const save = db.transaction((rows) => {
    for (const item of rows) {
      insert.run({
        name: item.name || "",
        phone: normalizePhone(item.phone),
        field1: item.field1 || item.campo1 || "",
        field2: item.field2 || item.campo2 || "",
        vencimento: item.vencimento || "",
        plano: item.plano || "",
        source: item.source || "import",
        consent_status: item.consent_status || "opt_in"
      });
    }
  });

  save(valid);
  res.status(201).json({ imported: valid.length, invalid, duplicates });
});

contactsRouter.post("/:phone/opt-out", (req, res) => {
  const phone = normalizePhone(req.params.phone);
  if (!phone) return res.status(422).json({ message: "Numero invalido" });
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO opt_outs (phone, reason) VALUES (?, ?)
      ON CONFLICT(phone) DO UPDATE SET reason = excluded.reason
    `).run(phone, String(req.body?.reason || "Solicitacao do contato"));
    db.prepare("UPDATE contacts SET consent_status = 'opt_out' WHERE phone = ?").run(phone);
    db.prepare(`
      UPDATE campaign_recipients
         SET status = 'opted_out', last_error = 'Contato opt-out'
       WHERE phone = ? AND status IN ('pending', 'processing', 'failed')
    `).run(phone);
  });
  transaction();
  res.json({ phone, consentStatus: "opt_out" });
});
