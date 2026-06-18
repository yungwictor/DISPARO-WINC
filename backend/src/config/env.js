import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const fallbackSecret = randomBytes(32).toString("hex");
const generatedAdminPassword = randomBytes(18).toString("base64url");
const nodeEnv = process.env.NODE_ENV || "development";

function requiredInProduction(key, fallback = "") {
  const value = process.env[key];

  if (nodeEnv === "production" && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || fallback;
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 3333),
  jwtSecret: requiredInProduction("JWT_SECRET", fallbackSecret),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  databasePath: resolve(process.env.DATABASE_PATH || "./backend/storage/disparo-winc.sqlite"),
  uploadDir: resolve(process.env.UPLOAD_DIR || "./backend/uploads"),
  adminName: process.env.ADMIN_NAME || "Operador Winc",
  adminEmail: process.env.ADMIN_EMAIL || "admin@localhost.invalid",
  adminPassword: requiredInProduction("ADMIN_PASSWORD", generatedAdminPassword),
  generatedAdminPassword: !process.env.ADMIN_PASSWORD ? generatedAdminPassword : "",
  officialApiToken: process.env.WHATSAPP_OFFICIAL_TOKEN || "",
  officialApiPhoneId: process.env.WHATSAPP_OFFICIAL_PHONE_ID || "",
  wppConnectUrl: process.env.WPP_CONNECT_URL || ""
};
