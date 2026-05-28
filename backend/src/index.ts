import cors from "cors";
import express from "express";
import { sessionsRouter } from "./routes/sessions.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "personal-medfinder-api" });
});

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

app.listen(PORT, () => {
  console.log(`Personal Medfinder API listening on http://localhost:${PORT}`);
});
