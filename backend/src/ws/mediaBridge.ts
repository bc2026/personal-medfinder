import WebSocket from "ws";
import { prisma } from "../lib/prisma.js";
import { stockCheckExtractionSchema } from "../services/voiceCall.js";

const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

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

export function handleTwilioMediaStream(twilioWs: WebSocket): void {
  let streamSid: string | null = null;
  let voiceCallId: string | null = null;
  let openaiWs: WebSocket | null = null;
  let transcript = "";
  let extractedData: unknown = null;
  let finalized = false;

  async function initOpenAI(session: {
    medicationName: string;
    strength: string | null;
    quantity: string | null;
    userNotes: string | null;
  }) {
    openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    openaiWs.on("open", () => {
      openaiWs!.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: buildInstructions(session),
            voice: "alloy",
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800,
            },
            tools: [
              {
                type: "function",
                name: "record_stock_status",
                description:
                  "Record the outcome of the pharmacy stock check. Call this when you have the answer or the call is ending.",
                parameters: {
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
                },
              },
            ],
            tool_choice: "auto",
          },
        })
      );
    });

    openaiWs.on("message", async (raw) => {
      try {
        const event = JSON.parse(raw.toString()) as Record<string, unknown>;

        // Stream TTS audio back to Twilio
        if (
          event.type === "response.audio.delta" &&
          typeof event.delta === "string" &&
          streamSid
        ) {
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: event.delta },
              })
            );
          }
        }

        // Agent transcript
        if (
          event.type === "response.audio_transcript.done" &&
          typeof event.transcript === "string"
        ) {
          transcript += `Agent: ${event.transcript.trim()}\n`;
        }

        // Pharmacy transcript
        if (
          event.type ===
            "conversation.item.input_audio_transcription.completed" &&
          typeof event.transcript === "string"
        ) {
          transcript += `Pharmacy: ${event.transcript.trim()}\n`;
        }

        // Structured extraction via tool call
        if (
          event.type === "response.function_call_arguments.done" &&
          event.name === "record_stock_status" &&
          typeof event.arguments === "string"
        ) {
          try {
            const args = JSON.parse(event.arguments);
            const parsed = stockCheckExtractionSchema.safeParse(args);
            if (parsed.success) extractedData = parsed.data;
          } catch {
            // ignore parse errors
          }

          // Acknowledge so the model can continue/close the conversation
          openaiWs!.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: event.call_id,
                output: JSON.stringify({ ok: true }),
              },
            })
          );
          openaiWs!.send(JSON.stringify({ type: "response.create" }));
        }
      } catch {
        // ignore malformed events
      }
    });

    openaiWs.on("error", (err) => {
      console.error("[OpenAI Realtime]", err.message);
    });

    openaiWs.on("close", () => {
      openaiWs = null;
    });
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
            await initOpenAI(voiceCall.pharmacy.searchSession);
          }
        }
        return;
      }

      if (
        msg.event === "media" &&
        msg.media &&
        openaiWs?.readyState === WebSocket.OPEN
      ) {
        openaiWs.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: msg.media.payload,
          })
        );
        return;
      }

      if (msg.event === "stop") {
        await doFinalize();
        openaiWs?.close();
      }
    } catch (err) {
      console.error("[Twilio WS] message error", err);
    }
  });

  twilioWs.on("close", async () => {
    await doFinalize();
    openaiWs?.close();
  });

  async function doFinalize() {
    if (finalized || !voiceCallId) return;
    finalized = true;

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
            note: `[Voice agent] ${extracted.data.note}`,
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
