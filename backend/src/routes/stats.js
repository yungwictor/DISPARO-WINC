import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { buildStats } from "../services/queueService.js";

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get("/", (req, res) => {
  res.json({ stats: buildStats() });
});
