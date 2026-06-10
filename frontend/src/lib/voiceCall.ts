import type { Pharmacy, SearchSession, VoiceCall, VoiceCallStatus } from "../types";

const ACTIVE: VoiceCallStatus[] = [
  "pending",
  "queued",
  "ringing",
  "in_progress",
];

/** Keep polling briefly after call ends until webhook writes contact log / analysis. */
const POST_CALL_POLL_MS = 120_000;

export function latestVoiceCall(calls: VoiceCall[] | undefined): VoiceCall | null {
  if (!calls?.length) return null;
  return calls[0];
}

export function isVoiceCallActive(call: VoiceCall | null): boolean {
  return call != null && ACTIVE.includes(call.status);
}

/** Call ended but end-of-call-report may still be in flight. */
export function isAwaitingPostCallData(call: VoiceCall | null): boolean {
  if (!call || call.status !== "completed") return false;
  if (call.contactLogId) return false;
  const age = Date.now() - new Date(call.updatedAt).getTime();
  return age < POST_CALL_POLL_MS;
}

export function pharmacyNeedsVoiceRefresh(pharmacy: Pharmacy): boolean {
  const call = latestVoiceCall(pharmacy.voiceCalls);
  if (!call) return false;
  return isVoiceCallActive(call) || isAwaitingPostCallData(call);
}

export function sessionNeedsVoiceRefresh(session: SearchSession | null): boolean {
  if (!session) return false;
  return session.pharmacies.some(pharmacyNeedsVoiceRefresh);
}

export const VOICE_CALL_LABELS: Record<VoiceCallStatus, string> = {
  pending: "Starting call…",
  queued: "Queued",
  ringing: "Ringing…",
  in_progress: "On call…",
  completed: "Call finished",
  failed: "Call failed",
};
