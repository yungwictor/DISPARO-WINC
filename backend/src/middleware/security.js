import cors from "cors";
import helmet from "helmet";
import express from "express";
import { env } from "../config/env.js";

const hits = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "local";
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = hits.get(key) || [];
  const fresh = bucket.filter((at) => now - at < windowMs);
  fresh.push(now);
  hits.set(key, fresh);

  if (fresh.length > 240) {
    return res.status(429).json({ message: "Muitas requisicoes em pouco tempo" });
  }

  next();
}

export function applySecurity(app) {
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true, limit: "8mb" }));
  app.use(rateLimit);
}
