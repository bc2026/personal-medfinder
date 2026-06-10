import { z } from "zod";
import {
  isDialableE164,
  normalizePhoneToE164,
} from "../lib/phone.js";
import { PHARMACY_STATUSES } from "../lib/validation.js";

const VAPI_API = "https://api.vapi.ai";

const CONTACT_STATUSES = PHARMACY_STATUSES.filter(
  (s) => s !== "not_contacted"
) as [
  "called",
  "in_stock",
  "out_of_stock",
  "partial_stock",
  "will_order",
  "left_voicemail",
];

export const stockCheckExtractionSchema = z.object({
  status: z.enum(CONTACT_STATUSES),
  note: z.string().max(5000).optional(),
  nextStep: z.string().max(500).optional(),
  priceQuoted: z.string().max(100).optional(),
  insuranceAccepted: z.enum(["yes", "no", "unknown"]).optional(),
  availableMedications: z.array(z.string().max(200)).max(10).optional(),
});

export type StockCheckExtraction = z.infer<typeof stockCheckExtractionSchema>;

export function voiceAgentEnabled(): boolean {
  return Boolean(
    process.env.VAPI_API_KEY &&
      process.env.VAPI_PHONE_NUMBER_ID &&
      process.env.PUBLIC_API_URL
  );
}

export function voiceAgentConfig() {
  return {
    enabled: voiceAgentEnabled(),
    provider: "vapi",
    hasAssistantId: Boolean(process.env.VAPI_ASSISTANT_ID),
  };
}

function buildWebhookServer(): { url: string; secret?: string } {
  const server: { url: string; secret?: string } = {
    url: `${process.env.PUBLIC_API_URL!.replace(/\/$/, "")}/api/webhooks/vapi`,
  };
  if (process.env.VAPI_WEBHOOK_SECRET) {
    server.secret = process.env.VAPI_WEBHOOK_SECRET;
  }
  return server;
}

function medicationLine(input: {
  medicationName: string;
  strength?: string | null;
  quantity?: string | null;
}): string {
  return [input.medicationName, input.strength, input.quantity]
    .filter(Boolean)
    .join(" ");
}

function buildAssistant(session: {
  medicationName: string;
  strength: string | null;
  quantity: string | null;
  userNotes: string | null;
}) {
  const med = medicationLine(session);
  const notes = session.userNotes ? ` Additional context: ${session.userNotes}` : "";

  return {
    name: "Medfinder stock check",
    firstMessage:
      "Hi, I'm calling from a personal medication finder app on behalf of a patient. I'm checking whether you have a prescription in stock. Is there someone in the pharmacy who can help with a quick availability check?",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are a polite phone assistant helping a patient find medication. You are NOT a pharmacy employee.

Goals:
1. Reach a pharmacy staff member (not voicemail if possible).
2. Ask if they have "${med}" in stock or can order it soon.
3. Ask about cash price if they have it, and whether they need the exact brand or generic is OK.
4. Keep the call brief and respectful of their time.

Rules:
- Say upfront you are an automated assistant calling for a patient using a personal med-finder tool.
- Do not share patient name, date of birth, insurance ID, or prescription number.
- If put on hold, wait patiently up to 2 minutes then summarize what you learned.
- If you reach voicemail, leave a brief message with the medication name and callback number if provided in variables.
- If they cannot disclose stock by phone, note that and set status to "called".
${notes}`,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: "sarah",
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2-phonecall",
      language: "en",
    },
    serverMessages: ["status-update", "transcript", "end-of-call-report"],
    analysisPlan: {
      structuredDataPlan: {
        enabled: true,
        schema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: CONTACT_STATUSES,
              description:
                "Stock outcome: in_stock, out_of_stock, partial_stock, will_order, left_voicemail, or called if unclear",
            },
            note: {
              type: "string",
              description: "Summary of what pharmacy staff said",
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
                "Specific formulations, strengths, or variants the pharmacy has. E.g. ['Generic 20mg 30ct – $45', 'Can order 30mg, ready Thursday']. Empty if nothing specific was mentioned.",
            },
          },
          required: ["status", "note"],
        },
        messages: [
          {
            role: "system",
            content:
              "Extract pharmacy stock-check results from the call transcript. Use left_voicemail if only voicemail was reached. Use called if staff could not answer or policy prevents sharing stock by phone. Populate availableMedications with any specific items, strengths, or variants the pharmacy mentioned having.",
          },
        ],
      },
    },
  };
}

export async function startPharmacyVoiceCall(input: {
  voiceCallId: string;
  pharmacy: { id: string; name: string; phone: string };
  session: {
    id: string;
    medicationName: string;
    strength: string | null;
    quantity: string | null;
    userNotes: string | null;
  };
}): Promise<{ externalId: string; listenUrl: string | null }> {
  if (!voiceAgentEnabled()) {
    throw new Error(
      "Voice agent is not configured. Set VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, and PUBLIC_API_URL."
    );
  }

  const customerNumber = normalizePhoneToE164(input.pharmacy.phone);
  if (!customerNumber || !isDialableE164(customerNumber)) {
    throw new Error(
      `Pharmacy phone number cannot be dialed (need a real US number with area code, not 555-xxxx placeholders): ${input.pharmacy.phone}`
    );
  }

  const webhookServer = buildWebhookServer();
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  const body: Record<string, unknown> = {
    type: "outboundPhoneCall",
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: { number: customerNumber, name: input.pharmacy.name },
    metadata: {
      voiceCallId: input.voiceCallId,
      pharmacyId: input.pharmacy.id,
      sessionId: input.session.id,
    },
  };

  if (assistantId) {
    body.assistantId = assistantId;
    body.assistantOverrides = {
      server: webhookServer,
      serverMessages: ["status-update", "transcript", "end-of-call-report"],
      variableValues: {
        medication: medicationLine(input.session),
        pharmacyName: input.pharmacy.name,
      },
      analysisPlan: buildAssistant(input.session).analysisPlan,
    };
  } else {
    body.assistant = {
      ...buildAssistant(input.session),
      server: webhookServer,
    };
  }

  const res = await fetch(`${VAPI_API}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Vapi call failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    id: string;
    monitor?: { listenUrl?: string };
  };
  return {
    externalId: data.id,
    listenUrl: data.monitor?.listenUrl ?? null,
  };
}

const ACTIVE_STATUSES = ["pending", "queued", "ringing", "in_progress"] as const;

export function isVoiceCallActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export async function cancelPharmacyVoiceCall(
  externalId: string | null
): Promise<void> {
  if (!externalId) return;

  if (!voiceAgentEnabled()) {
    throw new Error("Voice agent is not configured");
  }

  const res = await fetch(`${VAPI_API}/call/${externalId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errBody = await res.text();
    throw new Error(`Vapi cancel failed (${res.status}): ${errBody}`);
  }
}

const TRANSCRIPT_ROLE_LABEL: Record<string, string> = {
  assistant: "Agent",
  user: "Pharmacy",
  bot: "Agent",
};

export function appendLiveTranscript(
  current: string | null,
  role: string | undefined,
  text: string,
  transcriptType: string | undefined
): string {
  const label =
    TRANSCRIPT_ROLE_LABEL[role ?? ""] ??
    (role ? role.charAt(0).toUpperCase() + role.slice(1) : "Speaker");
  const line =
    transcriptType === "final" ? `${label}: ${text}` : `${label}: ${text}…`;

  if (!current?.trim()) return line;

  const lines = current.split("\n");
  const prefix = `${label}: `;
  const last = lines[lines.length - 1];
  const lastIsPartial =
    last.startsWith(prefix) && last.endsWith("…") && transcriptType !== "final";

  if (transcriptType === "final") {
    if (lastIsPartial) {
      lines[lines.length - 1] = line;
      return lines.join("\n");
    }
    return `${current}\n${line}`;
  }

  if (lastIsPartial) {
    lines[lines.length - 1] = line;
    return lines.join("\n");
  }

  return `${current}\n${line}`;
}

export function parseStructuredFromWebhook(payload: unknown): StockCheckExtraction | null {
  const root = payload as Record<string, unknown>;
  const message = (root.message ?? root) as Record<string, unknown>;
  const analysis = message.analysis as Record<string, unknown> | undefined;
  const artifact = message.artifact as Record<string, unknown> | undefined;

  const candidates: unknown[] = [
    analysis?.structuredData,
    analysis?.structuredDataMulti,
    message.structuredData,
  ];

  const structuredOutputs = artifact?.structuredOutputs as
    | Record<string, { result?: unknown }>
    | undefined;
  if (structuredOutputs) {
    for (const entry of Object.values(structuredOutputs)) {
      if (entry?.result) candidates.push(entry.result);
    }
  }

  for (const raw of candidates) {
    if (!raw || typeof raw !== "object") continue;
    const parsed = stockCheckExtractionSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }

  return null;
}

export function extractEndOfCallMetadata(message: Record<string, unknown>): {
  endedReason: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
} {
  const artifact = message.artifact as Record<string, unknown> | undefined;
  const call = message.call as Record<string, unknown> | undefined;

  const endedReason =
    (typeof message.endedReason === "string" && message.endedReason) ||
    (typeof artifact?.endedReason === "string" && artifact.endedReason) ||
    null;

  let durationSeconds: number | null = null;
  for (const raw of [
    message.duration,
    message.durationSeconds,
    artifact?.duration,
    artifact?.durationSeconds,
    call?.duration,
  ]) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      durationSeconds = Math.round(raw);
      break;
    }
    if (typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw)) {
      durationSeconds = Math.round(parseFloat(raw));
      break;
    }
  }

  let recordingUrl: string | null = null;
  const recording = artifact?.recording as Record<string, unknown> | undefined;
  for (const raw of [
    artifact?.recordingUrl,
    artifact?.stereoRecordingUrl,
    recording?.url,
    recording?.stereoUrl,
    message.recordingUrl,
  ]) {
    if (typeof raw === "string" && raw.startsWith("http")) {
      recordingUrl = raw;
      break;
    }
  }

  return { endedReason, durationSeconds, recordingUrl };
}

export function mapVapiStatus(status: string | undefined): string {
  switch (status) {
    case "queued":
      return "queued";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "in_progress";
    case "ended":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "in_progress";
  }
}
