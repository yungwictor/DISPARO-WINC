import { nanoid } from "nanoid";
import { db } from "../config/db.js";
import { env } from "../config/env.js";
import { emit } from "./socketService.js";
import { sleep } from "../utils/async.js";

function makeQrSvg(token) {
  const cells = Array.from({ length: 13 }, (_, y) =>
    Array.from({ length: 13 }, (_, x) => {
      const code = token.charCodeAt((x + y * 7) % token.length);
      const active = (code + x * 3 + y * 5) % 4 !== 0;
      return active ? `<rect x="${x * 12}" y="${y * 12}" width="10" height="10" rx="2"/>` : "";
    }).join("")
  ).join("");

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
    <rect width="220" height="220" rx="24" fill="#04110b"/>
    <g transform="translate(32 32)" fill="#27ff88">${cells}</g>
    <text x="110" y="200" text-anchor="middle" fill="#b9ffd6" font-family="monospace" font-size="12">DISPARO WINC</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function getSession() {
  return db.prepare("SELECT * FROM whatsapp_sessions ORDER BY id ASC LIMIT 1").get();
}

export function updateProvider(provider) {
  const cleanProvider = provider === "official" ? "official" : "wppconnect";
  db.prepare(`
    UPDATE whatsapp_sessions
    SET provider = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT id FROM whatsapp_sessions ORDER BY id ASC LIMIT 1)
  `).run(cleanProvider);

  const session = getSession();
  emit("whatsapp:session", session);
  return session;
}

export async function connectSession(provider = "wppconnect") {
  const cleanProvider = provider === "official" ? "official" : "wppconnect";
  const token = `WINC-${nanoid(18)}`;
  const qrCode = cleanProvider === "wppconnect" ? makeQrSvg(token) : null;

  db.prepare(`
    UPDATE whatsapp_sessions
    SET provider = ?, status = ?, qr_code = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT id FROM whatsapp_sessions ORDER BY id ASC LIMIT 1)
  `).run(cleanProvider, cleanProvider === "official" ? "online" : "qr_pending", qrCode);

  let session = getSession();
  emit("whatsapp:session", session);

  if (cleanProvider === "wppconnect") {
    setTimeout(() => {
      const current = getSession();
      if (!current || current.id !== session.id || current.status !== "qr_pending") return;
      db.prepare(`
        UPDATE whatsapp_sessions
        SET status = 'online', phone = '+5500000000000', last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(session.id);
      session = getSession();
      emit("whatsapp:session", session);
      emit("campaign:log", {
        level: "success",
        message: "Sessao WPP Connect simulada ficou online.",
        created_at: new Date().toISOString()
      });
    }, 4200);
  }

  return session;
}

export function disconnectSession() {
  db.prepare(`
    UPDATE whatsapp_sessions
    SET status = 'offline', qr_code = NULL, phone = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT id FROM whatsapp_sessions ORDER BY id ASC LIMIT 1)
  `).run();
  const session = getSession();
  emit("whatsapp:session", session);
  return session;
}

export async function sendMessage({ provider, phone, message, attachments = [], safeMode = true }) {
  const session = getSession();

  if (!session || session.status !== "online") {
    return { ok: false, error: "Sessao WhatsApp offline" };
  }

  await sleep(safeMode ? 650 : 220);

  const simulatedRisk = safeMode ? 0.04 : 0.11;
  const failed = Math.random() < simulatedRisk;

  if (failed) {
    return { ok: false, error: "Falha temporaria simulada do provedor" };
  }

  return {
    ok: true,
    provider: provider || session.provider,
    messageId: `winc_${nanoid(12)}`,
    phone,
    preview: message.slice(0, 120),
    attachments: attachments.length,
    mode: env.officialApiToken || env.wppConnectUrl ? "adapter-ready" : "simulated"
  };
}

export function listGroups() {
  return [
    { id: "grp-vip", name: "Clientes VIP", size: 143 },
    { id: "grp-renovacao", name: "Renovacao de Planos", size: 87 },
    { id: "grp-leads", name: "Leads Aquecidos", size: 236 }
  ];
}
