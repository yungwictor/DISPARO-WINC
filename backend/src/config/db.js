import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./env.js";

mkdirSync(dirname(env.databasePath), { recursive: true });

export const db = new Database(env.databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'wppconnect',
  status TEXT NOT NULL DEFAULT 'offline',
  session_name TEXT NOT NULL DEFAULT 'DISPARO-WINC-01',
  qr_code TEXT,
  phone TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT NOT NULL UNIQUE,
  field1 TEXT,
  field2 TEXT,
  vencimento TEXT,
  plano TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  consent_status TEXT NOT NULL DEFAULT 'opt_in',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'wppconnect',
  status TEXT NOT NULL DEFAULT 'draft',
  delay_min INTEGER NOT NULL DEFAULT 8,
  delay_max INTEGER NOT NULL DEFAULT 22,
  safe_mode INTEGER NOT NULL DEFAULT 1,
  warmup_mode INTEGER NOT NULL DEFAULT 0,
  attachments TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  field1 TEXT,
  field2 TEXT,
  vencimento TEXT,
  plano TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status
ON campaign_recipients(campaign_id, status);

CREATE TABLE IF NOT EXISTS campaign_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const userCount = db.prepare("SELECT COUNT(*) AS total FROM users").get().total;
if (!userCount) {
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'admin')
  `).run(env.adminName, env.adminEmail, bcrypt.hashSync(env.adminPassword, 10));

  if (env.generatedAdminPassword && env.nodeEnv !== "production") {
    console.warn(`DISPARO WINC admin criado: ${env.adminEmail}`);
    console.warn(`Senha temporaria de desenvolvimento: ${env.generatedAdminPassword}`);
    console.warn("Defina ADMIN_PASSWORD no ambiente para usar uma senha fixa segura.");
  }
}

const sessionCount = db.prepare("SELECT COUNT(*) AS total FROM whatsapp_sessions").get().total;
if (!sessionCount) {
  db.prepare(`
    INSERT INTO whatsapp_sessions (provider, status, session_name)
    VALUES ('wppconnect', 'offline', 'DISPARO-WINC-01')
  `).run();
}

const defaultSettings = {
  safeMode: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  maxPerMinute: 18,
  dailyLimit: 800,
  optOutWords: ["parar", "sair", "cancelar", "remover"],
  notificationSound: true
};

for (const [key, value] of Object.entries(defaultSettings)) {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO NOTHING
  `).run(key, JSON.stringify(value));
}

export function readSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return rows.reduce((acc, row) => {
    try {
      acc[row.key] = JSON.parse(row.value);
    } catch {
      acc[row.key] = row.value;
    }
    return acc;
  }, {});
}

export function writeSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value));
}
