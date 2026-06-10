import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { mapTwilioStatus } from "../services/twilioCall.js";

export const twilioWebhookRouter = Router();

function publicWssUrl(): string {
  const base = process.env.PUBLIC_API_URL!.replace(/\/$/, "");
  return (
    base.replace(/^https?/, (p) => (p === "https" ? "wss" : "ws")) +
    "/api/ws/twilio"
  );
}

// Twilio fetches this when the call connects — we return TwiML with a media stream
twilioWebhookRouter.post("/twilio/twiml", (req, res) => {
  const voiceCallId =
    (req.query.voiceCallId as string | undefined) ??
    (req.body?.voiceCallId as string | undefined);

  if (!voiceCallId) {
    res.set("Content-Type", "text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
    return;
  }

  const streamUrl = publicWssUrl();

  res.set("Content-Type", "text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="voiceCallId" value="${voiceCallId}"/>
    </Stream>
  </Connect>
</Response>`
  );
});

// Twilio posts call status updates here
twilioWebhookRouter.post("/twilio/status", async (req, res) => {
  const { CallSid, CallStatus } = req.body as {
    CallSid?: string;
    CallStatus?: string;
  };

  if (!CallSid || !CallStatus) {
    res.status(200).json({ ok: true });
    return;
  }

  const voiceCall = await prisma.voiceCall.findFirst({
    where: { externalId: CallSid },
  });

  if (!voiceCall) {
    res.status(200).json({ ok: true });
    return;
  }

  // Don't overwrite terminal states set by the media bridge
  if (voiceCall.status === "completed" || voiceCall.status === "failed") {
    res.status(200).json({ ok: true });
    return;
  }

  const status = mapTwilioStatus(CallStatus);

  if (status === "failed") {
    await prisma.voiceCall.update({
      where: { id: voiceCall.id },
      data: {
        status: "failed",
        errorMessage: `Call ended with status: ${CallStatus}`,
        endedReason: CallStatus,
      },
    });
  } else if (status !== "completed") {
    // completed is handled by the media bridge; only update transitional states here
    await prisma.voiceCall.update({
      where: { id: voiceCall.id },
      data: { status },
    });
  }

  res.status(200).json({ ok: true });
});
