export type TranscriptSpeaker = "assistant" | "user";

export interface TranscriptMessage {
  speaker: TranscriptSpeaker;
  label: string;
  text: string;
  partial?: boolean;
}

const SPEAKER_MAP: Record<string, TranscriptSpeaker> = {
  agent: "assistant",
  assistant: "assistant",
  bot: "assistant",
  pharmacy: "user",
  user: "user",
  customer: "user",
};

export function parseTranscript(
  transcript: string | null | undefined
): TranscriptMessage[] {
  if (!transcript?.trim()) return [];

  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) {
        return {
          speaker: "user" as const,
          label: "Speaker",
          text: line,
        };
      }

      const rawLabel = match[1]!.trim();
      let text = match[2]!.trim();
      const partial = text.endsWith("…");
      if (partial) text = text.slice(0, -1);

      const speaker =
        SPEAKER_MAP[rawLabel.toLowerCase()] ??
        (rawLabel.toLowerCase().includes("agent") ? "assistant" : "user");

      return {
        speaker,
        label: speaker === "assistant" ? "Assistant" : "User",
        text,
        partial,
      };
    });
}

export function formatCallDuration(
  seconds: number | null | undefined
): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}m ${secs}s`;
}

export function formatEndedReason(reason: string | null | undefined): string | null {
  if (!reason?.trim()) return null;
  return reason
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAudioTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
