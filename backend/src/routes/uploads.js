import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { db } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

mkdirSync(env.uploadDir, { recursive: true });

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "application/pdf",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav"
]);

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".mp4", ".pdf", ".mp3", ".ogg", ".wav"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadDir),
  filename: (req, file, cb) => {
    const extension = extname(file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(extension)) return cb(new Error("Extensão de arquivo não permitida"));
    cb(null, `${Date.now()}-${nanoid(8)}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error("Tipo de arquivo não permitido"));
    cb(null, true);
  }
});

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

uploadsRouter.post("/", upload.array("files", 8), (req, res) => {
  const files = (req.files || []).map((file) => {
    const row = db.prepare(`
      INSERT INTO uploads (original_name, file_name, mime_type, size, path)
      VALUES (?, ?, ?, ?, ?)
    `).run(file.originalname, file.filename, file.mimetype, file.size, join(env.uploadDir, file.filename));

    return {
      id: row.lastInsertRowid,
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size
    };
  });

  res.status(201).json({ files });
});
