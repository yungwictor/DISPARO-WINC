import { Router } from "express";
import { readSettings, writeSetting } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get("/", (req, res) => {
  res.json({ settings: readSettings() });
});

settingsRouter.put("/", (req, res) => {
  for (const [key, value] of Object.entries(req.body || {})) {
    writeSetting(key, value);
  }
  res.json({ settings: readSettings() });
});
