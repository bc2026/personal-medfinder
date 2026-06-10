import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import {
  cancelPharmacyVoiceCall,
  isVoiceCallActiveStatus,
  startPharmacyVoiceCall,
  voiceAgentConfig as vapiConfig,
  voiceAgentEnabled as vapiEnabled,
} from "../services/voiceCall.js";
import {
  cancelTwilioCall,
  startTwilioCall,
  twilioConfig,
  twilioEnabled,
} from "../services/twilioCall.js";

export const voiceRouter = Router();

function activeProvider(): "vapi" | "twilio" | null {
  const p = (process.env.VOICE_PROVIDER ?? "vapi").toLowerCase();
  if (p === "twilio") return twilioEnabled() ? "twilio" : null;
  return vapiEnabled() ? "vapi" : null;
}

function voiceConfig() {
  const p = (process.env.VOICE_PROVIDER ?? "vapi").toLowerCase();
  if (p === "twilio") return twilioConfig();
  return vapiConfig();
}

voiceRouter.get("/config", (_req, res) => {
  res.json(voiceConfig());
});

voiceRouter.get("/calls/:voiceCallId", async (req, res) => {
  const voiceCall = await prisma.voiceCall.findUnique({
    where: { id: req.params.voiceCallId },
    include: {
      pharmacy: {
        select: {
          id: true,
          name: true,
          phone: true,
          searchSessionId: true,
        },
      },
    },
  });

  if (!voiceCall) {
    res.status(404).json({ error: "Voice call not found" });
    return;
  }

  const siblingCalls = await prisma.voiceCall.findMany({
    where: { pharmacyId: voiceCall.pharmacyId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  res.json({
    ...voiceCall,
    siblingCallIds: siblingCalls.map((c) => c.id),
  });
});

voiceRouter.post("/calls/:voiceCallId/cancel", async (req, res) => {
  const voiceCall = await prisma.voiceCall.findUnique({
    where: { id: req.params.voiceCallId },
  });

  if (!voiceCall) {
    res.status(404).json({ error: "Voice call not found" });
    return;
  }

  if (!isVoiceCallActiveStatus(voiceCall.status)) {
    res.status(400).json({ error: "Call is not active" });
    return;
  }

  try {
    if (voiceCall.provider === "twilio") {
      await cancelTwilioCall(voiceCall.externalId);
    } else {
      await cancelPharmacyVoiceCall(voiceCall.externalId);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to cancel call";
    res.status(502).json({ error: message });
    return;
  }

  const updated = await prisma.voiceCall.update({
    where: { id: voiceCall.id },
    data: { status: "failed", errorMessage: "Cancelled by user" },
  });

  res.json(updated);
});

voiceRouter.post(
  "/sessions/:sessionId/pharmacies/:pharmacyId/call",
  async (req, res) => {
    const provider = activeProvider();

    if (!provider) {
      res.status(503).json({
        error:
          "Voice agent not configured. See backend/.env.example for required variables.",
      });
      return;
    }

    const pharmacy = await prisma.pharmacy.findFirst({
      where: {
        id: req.params.pharmacyId,
        searchSessionId: req.params.sessionId,
      },
      include: { searchSession: true },
    });

    if (!pharmacy) {
      res.status(404).json({ error: "Pharmacy not found" });
      return;
    }

    if (!pharmacy.phone) {
      res.status(400).json({ error: "Pharmacy has no phone number on file" });
      return;
    }

    const active = await prisma.voiceCall.findFirst({
      where: {
        pharmacyId: pharmacy.id,
        status: { in: ["pending", "queued", "ringing", "in_progress"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (active) {
      res.status(409).json({
        error: "A voice call is already in progress for this pharmacy",
        voiceCall: active,
      });
      return;
    }

    const voiceCall = await prisma.voiceCall.create({
      data: {
        pharmacyId: pharmacy.id,
        status: "pending",
        provider,
      },
    });

    try {
      let externalId: string;
      let listenUrl: string | null;

      if (provider === "twilio") {
        const result = await startTwilioCall({
          voiceCallId: voiceCall.id,
          pharmacy: { phone: pharmacy.phone },
        });
        externalId = result.externalId;
        listenUrl = result.listenUrl;
      } else {
        const result = await startPharmacyVoiceCall({
          voiceCallId: voiceCall.id,
          pharmacy: {
            id: pharmacy.id,
            name: pharmacy.name,
            phone: pharmacy.phone,
          },
          session: pharmacy.searchSession,
        });
        externalId = result.externalId;
        listenUrl = result.listenUrl;
      }

      const updated = await prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: { externalId, listenUrl, status: "queued" },
      });

      res.status(201).json(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start call";
      await prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: { status: "failed", errorMessage: message },
      });
      res.status(502).json({ error: message });
    }
  }
);
