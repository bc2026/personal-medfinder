import { isDialableE164, normalizePhoneToE164 } from "../lib/phone.js";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? undefined;
}

export function twilioEnabled(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER &&
      process.env.PUBLIC_API_URL &&
      geminiApiKey()
  );
}

export function twilioConfig() {
  return {
    enabled: twilioEnabled(),
    provider: "twilio",
  };
}

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

export async function startTwilioCall(input: {
  voiceCallId: string;
  pharmacy: { phone: string };
}): Promise<{ externalId: string; listenUrl: null }> {
  if (!twilioEnabled()) {
    throw new Error(
      "Twilio voice agent not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, PUBLIC_API_URL, and GEMINI_API_KEY (or GOOGLE_API_KEY) for Gemini Live."
    );
  }

  const to = normalizePhoneToE164(input.pharmacy.phone);
  if (!to || !isDialableE164(to)) {
    throw new Error(
      `Pharmacy phone number cannot be dialed: ${input.pharmacy.phone}`
    );
  }

  const base = process.env.PUBLIC_API_URL!.replace(/\/$/, "");
  const params = new URLSearchParams({
    To: to,
    From: process.env.TWILIO_PHONE_NUMBER!,
    Url: `${base}/api/webhooks/twilio/twiml?voiceCallId=${input.voiceCallId}`,
    StatusCallback: `${base}/api/webhooks/twilio/status`,
    StatusCallbackMethod: "POST",
  });

  const res = await fetch(
    `${TWILIO_API}/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twilio call failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { sid: string };
  return { externalId: data.sid, listenUrl: null };
}

export async function cancelTwilioCall(
  externalId: string | null
): Promise<void> {
  if (!externalId) return;

  const res = await fetch(
    `${TWILIO_API}/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls/${externalId}.json`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Status: "canceled" }).toString(),
    }
  );

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Twilio cancel failed (${res.status}): ${body}`);
  }
}

export function mapTwilioStatus(status: string | undefined): string {
  switch (status) {
    case "queued":
      return "queued";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "failed":
    case "busy":
    case "no-answer":
    case "canceled":
      return "failed";
    default:
      return "in_progress";
  }
}
