import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import {
  appendLiveTranscript,
  extractEndOfCallMetadata,
  mapVapiStatus,
  parseStructuredFromWebhook,
} from "../services/voiceCall.js";

export const voiceWebhookRouter = Router();

function verifySecret(req: { headers: Record<string, unknown> }): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true;
  const header = req.headers["x-vapi-secret"];
  return header === secret;
}

voiceWebhookRouter.post("/vapi", async (req, res) => {
  if (!verifySecret(req)) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }

  const body = req.body as {
    message?: {
      type?: string;
      status?: string;
      endedReason?: string;
      call?: {
        id?: string;
        status?: string;
        metadata?: Record<string, string>;
      };
      transcript?: string;
      transcriptType?: string;
      role?: string;
      analysis?: unknown;
      artifact?: unknown;
    };
  };

  const message = body.message;
  if (!message?.type) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const call = message.call;
  const voiceCallId =
    call?.metadata?.voiceCallId ??
    (typeof call?.metadata === "object" && call?.metadata
      ? (call.metadata as Record<string, string>).voiceCallId
      : undefined);

  if (!voiceCallId) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const voiceCall = await prisma.voiceCall.findUnique({
    where: { id: voiceCallId },
    include: {
      pharmacy: {
        include: {
          searchSession: true,
        },
      },
    },
  });

  if (!voiceCall) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  if (message.type === "status-update") {
    let status = mapVapiStatus(call?.status ?? message.status);
    // Stay in_progress until end-of-call-report creates the contact log entry.
    if (status === "completed") {
      status = "in_progress";
    }
    await prisma.voiceCall.update({
      where: { id: voiceCall.id },
      data: {
        status,
        externalId: call?.id ?? voiceCall.externalId,
        endedReason:
          typeof message.endedReason === "string"
            ? message.endedReason
            : undefined,
      },
    });
    res.status(200).json({ ok: true });
    return;
  }

  if (
    message.type === "transcript" ||
    message.type === 'transcript[transcriptType="final"]'
  ) {
    const text = message.transcript?.trim();
    if (text) {
      const transcriptType =
        message.transcriptType ??
        (message.type.includes("final") ? "final" : "partial");
      await prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: {
          transcript: appendLiveTranscript(
            voiceCall.transcript,
            message.role,
            text,
            transcriptType
          ),
          externalId: call?.id ?? voiceCall.externalId,
        },
      });
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (message.type !== "end-of-call-report") {
    res.status(200).json({ ok: true, ignored: message.type });
    return;
  }

  const extracted = parseStructuredFromWebhook(body);
  const { endedReason, durationSeconds, recordingUrl } = extractEndOfCallMetadata(
    message as Record<string, unknown>
  );
  const reportTranscript =
    message.transcript ??
    (typeof message.artifact === "object" &&
    message.artifact &&
    "transcript" in (message.artifact as object)
      ? String((message.artifact as { transcript?: string }).transcript ?? "")
      : null);
  const transcript =
    (reportTranscript?.trim() ? reportTranscript : null) ??
    voiceCall.transcript;

  const failed = call?.status === "failed" || message.endedReason === "failed";
  const updateData: {
    status: string;
    externalId?: string;
    transcript?: string;
    extractedJson?: string;
    errorMessage?: string;
    contactLogId?: string;
    endedReason?: string;
    durationSeconds?: number;
    recordingUrl?: string;
  } = {
    status: failed ? "failed" : "completed",
    externalId: call?.id ?? voiceCall.externalId ?? undefined,
    transcript: transcript ?? undefined,
    extractedJson: extracted ? JSON.stringify(extracted) : undefined,
    errorMessage: failed ? message.endedReason ?? "Call failed" : undefined,
    endedReason: endedReason ?? undefined,
    durationSeconds: durationSeconds ?? undefined,
    recordingUrl: recordingUrl ?? undefined,
  };

  if (!failed) {
    if (extracted) {
      const log = await prisma.pharmacyContactLog.create({
        data: {
          pharmacyId: voiceCall.pharmacyId,
          status: extracted.status,
          note: extracted.note
            ? `[Voice agent] ${extracted.note}`
            : "[Voice agent] Call completed",
          nextStep: extracted.nextStep,
          priceQuoted: extracted.priceQuoted,
          insuranceAccepted: extracted.insuranceAccepted,
        },
      });
      updateData.contactLogId = log.id;

      if (extracted.availableMedications?.length) {
        await prisma.pharmacy.update({
          where: { id: voiceCall.pharmacyId },
          data: {
            availableMedications: JSON.stringify(extracted.availableMedications),
          },
        });
      }
    } else {
      const log = await prisma.pharmacyContactLog.create({
        data: {
          pharmacyId: voiceCall.pharmacyId,
          status: "called",
          note: `[Voice agent] Call ended without structured result.${transcript ? ` Transcript: ${transcript.slice(0, 500)}` : ""}`,
        },
      });
      updateData.contactLogId = log.id;
    }
  }

  await prisma.voiceCall.update({
    where: { id: voiceCall.id },
    data: updateData,
  });

  res.status(200).json({ ok: true });
});
