import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { db } from "../config/db.js";

let ioInstance = null;

export function attachSocket(io) {
  ioInstance = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Token ausente"));
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(payload.sub);
      if (!user) return next(new Error("Usuario invalido"));
      socket.user = user;
      return next();
    } catch {
      return next(new Error("Token invalido"));
    }
  });

  io.on("connection", (socket) => {
    socket.emit("system:ready", {
      message: "DISPARO WINC em tempo real",
      at: new Date().toISOString()
    });

    socket.on("campaign:join", (campaignId) => {
      socket.join(`campaign:${campaignId}`);
    });

    socket.on("campaign:leave", (campaignId) => {
      socket.leave(`campaign:${campaignId}`);
    });
  });
}

export function emit(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}

export function emitToCampaign(campaignId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`campaign:${campaignId}`).emit(event, payload);
  ioInstance.emit(event, payload);
}
