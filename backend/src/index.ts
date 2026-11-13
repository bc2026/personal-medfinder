import cors from "cors";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { sessionsRouter } from "./routes/sessions.js";
import { voiceRouter } from "./routes/voice.js";
import { voiceWebhookRouter } from "./routes/voiceWebhook.js";
import { twilioWebhookRouter } from "./routes/twilioWebhook.js";
import { handleTwilioMediaStream } from "./ws/mediaBridge.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());
// Twilio webhooks send application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  const p = (process.env.VOICE_PROVIDER ?? "vapi").toLowerCase();
  const vapiReady = Boolean(
    process.env.VAPI_API_KEY &&
      process.env.VAPI_PHONE_NUMBER_ID &&
      process.env.PUBLIC_API_URL
  );
  const twilioReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER &&
      process.env.PUBLIC_API_URL &&
      (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)
  );
  res.json({
    ok: true,
    service: "personal-medfinder-api",
    voiceAgent: p === "twilio" ? twilioReady : vapiReady,
    voiceProvider: p,
  });
});

app.use("/api/webhooks", voiceWebhookRouter);
app.use("/api/webhooks", twilioWebhookRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/sessions", sessionsRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

const server = createServer(app);

// WebSocket server for Twilio media streams (Twilio <-> Gemini Live bridge)
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/api/ws/twilio")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleTwilioMediaStream(ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Personal Medfinder API listening on http://0.0.0.0:${PORT}`);
});
