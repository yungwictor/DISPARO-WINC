import http from "node:http";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import "./config/db.js";
import { applySecurity } from "./middleware/security.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { contactsRouter } from "./routes/contacts.js";
import { settingsRouter } from "./routes/settings.js";
import { statsRouter } from "./routes/stats.js";
import { uploadsRouter } from "./routes/uploads.js";
import { whatsappRouter } from "./routes/whatsapp.js";
import { attachSocket } from "./services/socketService.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.corsOrigin,
    credentials: true
  }
});

attachSocket(io);
applySecurity(app);

if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    name: "DISPARO WINC API",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRouter);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/stats", statsRouter);

app.use(notFound);
app.use(errorHandler);

server.listen(env.port, () => {
  console.log(`DISPARO WINC API online em http://localhost:${env.port}`);
});
