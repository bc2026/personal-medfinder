import WebSocket from "ws";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { prisma } from "../lib/prisma.js";
import { stockCheckExtractionSchema } from "../services/voiceCall.js";
import {
  geminiPcmToTwilioUlawPayload,
  twilioUlawToGeminiPcm16kBase64,
} from "./twilioGeminiAudio.js";

const DEFAULT_GEMINI_LIVE_MODEL =
  "gemini-2.5-flash-native-audio-preview-12-2025";

function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? undefined;
}

function liveModel(): string {
  return (
    process.env.GEMINI_LIVE_MODEL?.trim() || DEFAULT_GEMINI_LIVE_MODEL
  );
}

const RECORD_STOCK_STATUS_PARAMETERS = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: [
        "in_stock",
        "out_of_stock",
        "partial_stock",
        "will_order",
        "left_voicemail",
        "called",
      ],
      description: "Stock outcome",
    },
    note: {
      type: "string",
      description: "Summary of what pharmacy said",
    },
    nextStep: {
      type: "string",
      description: "Follow-up action for the patient, if any",
    },
    priceQuoted: {
      type: "string",
      description: "Price quoted if mentioned",
    },
    insuranceAccepted: {
      type: "string",
      enum: ["yes", "no", "unknown"],
    },
    availableMedications: {
      type: "array",
      items: { type: "string" },
      description:
        "Specific formulations, strengths, or variants the pharmacy has. E.g. ['Generic 20mg 30ct – $45', 'Can order 30mg, ready Thursday']. Leave empty if nothing specific was mentioned.",
    },
  },
  required: ["status", "note"],
};

function buildInstructions(session: {
  medicationName: string;
  strength: string | null;
  quantity: string | null;
  userNotes: string | null;
}): string {
  const med = [session.medicationName, session.strength, session.quantity]
    .filter(Boolean)
    .join(" ");
  const notes = session.userNotes
    ? ` Additional context: ${session.userNotes}`
    : "";

  return `You are a polite phone assistant helping a patient find medication. You are NOT a pharmacy employee.

Goals:
1. Identify yourself upfront as an automated assistant calling on behalf of a patient.
2. Ask if they have "${med}" in stock or can order it soon.
3. Ask about cash price and whether generic is acceptable.
4. Keep the call brief and respectful of their time.

Rules:
- Do NOT share patient name, date of birth, insurance ID, or prescription number.
- If placed on hold, wait up to 2 minutes, then summarize what you learned.
- If you reach voicemail, leave a brief message with the medication name.
- When you have gathered the information (or the call is clearly ending), call the record_stock_status function.${notes}`;
}

function handleGeminiServerMessage(
  message: LiveServerMessage,
  ctx: {
    twilioWs: WebSocket;
    streamSid: string | null;
    liveSession: Session | null;
    transcriptRef: { current: string };
    extractedRef: { current: unknown };
  }
): void {
  const sc = message.serverContent;
  if (sc?.inputTranscription?.finished && sc.inputTranscription.text?.trim()) {
    ctx.transcriptRef.current += `Pharmacy: ${sc.inputTranscription.text.trim()}\n`;
  }
  if (sc?.outputTranscription?.finished && sc.outputTranscription.text?.trim()) {
    ctx.transcriptRef.current += `Agent: ${sc.outputTranscription.text.trim()}\n`;
  }

  const modelTurn = sc?.modelTurn;
  for (const part of modelTurn?.parts ?? []) {
    const inline = part.inlineData;
    if (
      !inline?.data ||
      !inline.mimeType?.toLowerCase().startsWith("audio/")
    ) {
      continue;
    }
    if (!ctx.streamSid || ctx.twilioWs.readyState !== WebSocket.OPEN) {
      continue;
    }
    try {
      const payload = geminiPcmToTwilioUlawPayload(
        inline.data,
        inline.mimeType
      );
      ctx.twilioWs.send(
        JSON.stringify({
          event: "media",
          streamSid: ctx.streamSid,
          media: { payload },
        })
      );
    } catch {
      // ignore bad audio chunks
    }
  }

  const calls = message.toolCall?.functionCalls;
  if (!calls?.length || !ctx.liveSession) return;

  for (const call of calls) {
    if (call.name !== "record_stock_status" || !call.args) continue;
    try {
      const parsed = stockCheckExtractionSchema.safeParse(call.args);
      if (parsed.success) ctx.extractedRef.current = parsed.data;
    } catch {
      // ignore
    }
    if (call.id && call.name) {
      ctx.liveSession.sendToolResponse({
        functionResponses: {
          id: call.id,
          name: call.name,
          response: { ok: true },
        },
      });
    }
  }
}

export function handleTwilioMediaStream(twilioWs: WebSocket): void {
  let streamSid: string | null = null;
  let voiceCallId: string | null = null;
  let liveSession: Session | null = null;
  const transcriptRef = { current: "" };
  const extractedRef = { current: null as unknown };
  let finalized = false;

  async function initGemini(session: {
    medicationName: string;
    strength: string | null;
    quantity: string | null;
    userNotes: string | null;
  }) {
    const apiKey = geminiApiKey();
    if (!apiKey) {
      console.error(
        "[Gemini Live] Missing GEMINI_API_KEY (or GOOGLE_API_KEY); cannot start voice session."
      );
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
      liveSession = await ai.live.connect({
        model: liveModel(),
        config: {
          responseModalities: [Modality.AUDIO],
          temperature: 0.4,
          systemInstruction: {
            parts: [{ text: buildInstructions(session) }],
          },
          inputAudioTranscription: { languageCodes: ["en"] },
          outputAudioTranscription: { languageCodes: ["en"] },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "record_stock_status",
                  description:
                    "Record the outcome of the pharmacy stock check. Call this when you have the answer or the call is ending.",
                  parameters:
                    RECORD_STOCK_STATUS_PARAMETERS as unknown as Record<
                      string,
                      unknown
                    >,
                },
              ],
            },
          ],
        },
        callbacks: {
          onmessage: (msg: LiveServerMessage) => {
            handleGeminiServerMessage(msg, {
              twilioWs,
              streamSid,
              liveSession,
              transcriptRef,
              extractedRef,
            });
          },
          onerror: (e) => {
            console.error("[Gemini Live]", e);
          },
          onclose: () => {
            liveSession = null;
          },
        },
      });
    } catch (err) {
      console.error("[Gemini Live] connect failed", err);
      liveSession = null;
    }
  }

  twilioWs.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        event: string;
        start?: {
          streamSid: string;
          customParameters?: Record<string, string>;
        };
        media?: { payload: string };
      };

      if (msg.event === "start" && msg.start) {
        streamSid = msg.start.streamSid;
        voiceCallId = msg.start.customParameters?.voiceCallId ?? null;

        if (voiceCallId) {
          const voiceCall = await prisma.voiceCall.findUnique({
            where: { id: voiceCallId },
            include: { pharmacy: { include: { searchSession: true } } },
          });
          if (voiceCall) {
            await initGemini(voiceCall.pharmacy.searchSession);
          }
        }
        return;
      }

      if (msg.event === "media" && msg.media && liveSession) {
        try {
          const pcmB64 = twilioUlawToGeminiPcm16kBase64(msg.media.payload);
          liveSession.sendRealtimeInput({
            audio: {
              data: pcmB64,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } catch (err) {
          console.error("[mediaBridge] inbound audio transcode error", err);
        }
        return;
      }

      if (msg.event === "stop") {
        await doFinalize();
        liveSession?.close();
        liveSession = null;
      }
    } catch (err) {
      console.error("[Twilio WS] message error", err);
    }
  });

  twilioWs.on("close", async () => {
    await doFinalize();
    liveSession?.close();
    liveSession = null;
  });

  async function doFinalize() {
    if (finalized || !voiceCallId) return;
    finalized = true;

    const transcript = transcriptRef.current;
    const extractedData = extractedRef.current;

    try {
      const voiceCall = await prisma.voiceCall.findUnique({
        where: { id: voiceCallId },
      });
      if (
        !voiceCall ||
        voiceCall.status === "completed" ||
        voiceCall.status === "failed"
      )
        return;

      const extracted = stockCheckExtractionSchema.safeParse(extractedData);
      const trimmedTranscript = transcript.trim() || null;

      const updateData: Record<string, unknown> = {
        status: "completed",
        transcript: trimmedTranscript,
        extractedJson: extracted.success
          ? JSON.stringify(extracted.data)
          : null,
      };

      if (extracted.success) {
        const log = await prisma.pharmacyContactLog.create({
          data: {
            pharmacyId: voiceCall.pharmacyId,
            status: extracted.data.status,
            note: `[Voice agent] ${extracted.data.note ?? ""}`,
            nextStep: extracted.data.nextStep,
            priceQuoted: extracted.data.priceQuoted,
            insuranceAccepted: extracted.data.insuranceAccepted,
          },
        });
        updateData.contactLogId = log.id;

        if (extracted.data.availableMedications?.length) {
          await prisma.pharmacy.update({
            where: { id: voiceCall.pharmacyId },
            data: {
              availableMedications: JSON.stringify(
                extracted.data.availableMedications
              ),
            },
          });
        }
      } else {
        const log = await prisma.pharmacyContactLog.create({
          data: {
            pharmacyId: voiceCall.pharmacyId,
            status: "called",
            note: `[Voice agent] Call ended.${
              trimmedTranscript
                ? ` Transcript: ${trimmedTranscript.slice(0, 500)}`
                : ""
            }`,
          },
        });
        updateData.contactLogId = log.id;
      }

      await prisma.voiceCall.update({
        where: { id: voiceCallId },
        data: updateData,
      });
    } catch (err) {
      console.error("[mediaBridge] finalize error", err);
    }
  }
}
