import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { connectSession, disconnectSession, getSession, listGroups, updateProvider } from "../services/whatsappService.js";

export const whatsappRouter = Router();

whatsappRouter.use(requireAuth);

whatsappRouter.get("/session", (req, res) => {
  res.json({ session: getSession() });
});

whatsappRouter.post("/provider", (req, res) => {
  res.json({ session: updateProvider(req.body.provider) });
});

whatsappRouter.post("/connect", async (req, res, next) => {
  try {
    const session = await connectSession(req.body.provider);
    res.json({ session });
  } catch (error) {
    next(error);
  }
});

whatsappRouter.post("/disconnect", (req, res) => {
  res.json({ session: disconnectSession() });
});

whatsappRouter.get("/groups", (req, res) => {
  res.json({ groups: listGroups() });
});
