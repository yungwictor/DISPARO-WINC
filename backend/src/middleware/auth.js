import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { db } from "../config/db.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token ausente" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "Usuario invalido" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Token invalido ou expirado" });
  }
}
