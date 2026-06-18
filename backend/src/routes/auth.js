import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase());

  if (!user || !bcrypt.compareSync(String(password || ""), user.password_hash)) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(safeUser), user: safeUser });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
