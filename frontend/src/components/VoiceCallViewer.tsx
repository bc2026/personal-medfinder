import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { formatPhoneForDisplay } from "../lib/phone";
import {
  formatAudioTime,
  formatCallDuration,
  formatEndedReason,
  parseTranscript,
} from "../lib/transcript";
import {
  isAwaitingPostCallData,
  isVoiceCallActive,
  VOICE_CALL_LABELS,
} from "../lib/voiceCall";
import type { VoiceCallStatus } from "../types";
import type { StockCheckExtraction } from "../types";
import type { VoiceCallDetail } from "../types";

interface VoiceCallViewerProps {
  voiceCallId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

type TabId = "transcripts" | "analysis";

function IconClose() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden>
      <path d="M11.78 4.03a1 1 0 0 0-1.41-1.41L7.5 6.69 4.62 3.81A1 1 0 0 0 3.22 5.22L6.1 8.1l-2.88 2.88a1 1 0 1 0 1.41 1.41L7.5 9.52l3.88 3.87a1 1 0 0 0 1.41-1.41L8.9 8.1l2.88-2.87Z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg className="h-3 w-3 opacity-60" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d="M222.37 158.46l-47.11-21.11a16 16 0 0 0-15.17 1.4l-24.22 20.78c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71a16 16 0 0 0 1.32-15.06L97.54 33.64a16 16 0 0 0-16.62-9.52A56.26 56.26 0 0 0 32 80c0 79.4 64.6 144 144 144a56.26 56.26 0 0 0 55.88-48.92 16 16 0 0 0 46.49-65.54ZM176 208A128.14 128.14 0 0 1 48 80 40.2 40.2 0 0 1 82.87 40l21 47-20.67 24.86a16 16 0 0 0-1 15.7c9.06 18.53 27.73 37.06 46.46 46.11a16 16 0 0 0 15.75-1.14l24.94-20.67 47 21.05A40.21 40.21 0 0 1 176 208Z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="h-3 w-3 opacity-60" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88Zm64-88a8 8 0 0 1-8 8H128a8 8 0 0 1-8-8V72a8 8 0 0 1 16 0v48h48a8 8 0 0 1 8 8Z" />
    </svg>
  );
}

function IconChevron({ up }: { up?: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      {up ? (
        <path d="M213.66 165.66a8 8 0 0 1-11.32 0L128 91.31 53.66 165.66a8 8 0 0 1-11.32-11.32l80-80a8 8 0 0 1 11.32 0l80 80a8 8 0 0 1-11.32 11.32Z" />
      ) : (
        <path d="M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z" />
      )}
    </svg>
  );
}

function IconCopy() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d="M216 32H88a8 8 0 0 0-8 8v40H40a8 8 0 0 0-8 8v128a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8v-40h40a8 8 0 0 0 8-8V40a8 8 0 0 0-8-8ZM160 208H48V96h112v112Zm48-48h-32V88a8 8 0 0 0-8-8H96V48h112v112Z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d="M240 128a15.74 15.74 0 0 1-7.6 13.51L88.32 229.65a16 16 0 0 1-16.2.3A15.86 15.86 0 0 1 64 216.13V39.87a15.86 15.86 0 0 1 8.12-13.82 16 16 0 0 1 16.2.3L232.4 114.49A15.74 15.74 0 0 1 240 128Z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d="M200 32H168a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h32a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16Zm-104 0H64a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h32a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16Z" />
    </svg>
  );
}

function CallRecordingPlayer({
  url,
  durationSeconds,
}: {
  url: string;
  durationSeconds: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [url]);

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function seekFromClientX(clientX: number, el: HTMLElement) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  }

  function seekMouse(e: React.MouseEvent<HTMLDivElement>) {
    seekFromClientX(e.clientX, e.currentTarget);
  }

  function seekKeyboard(e: React.KeyboardEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const step = Math.max(5, duration / 20);
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        audio.currentTime = Math.min(duration, audio.currentTime + step);
        break;
      case "ArrowLeft":
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - step);
        break;
      case "Home":
        e.preventDefault();
        audio.currentTime = 0;
        break;
      case "End":
        e.preventDefault();
        audio.currentTime = duration;
        break;
      default:
        break;
    }
  }

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="text-lg font-bold">Recording</span>
        <span className="font-mono text-lg text-[var(--color-muted)]">
          {formatAudioTime(current)}
        </span>
      </div>
      <div
        ref={seekBarRef}
        tabIndex={0}
        className="relative h-12 cursor-pointer rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-elevated)]"
        onClick={seekMouse}
        onKeyDown={seekKeyboard}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={Math.ceil(duration || 0)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${formatAudioTime(current)} of ${formatAudioTime(duration)}`}
        aria-label="Seek recording"
      >
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-accent)]/25 transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-2 pointer-events-none opacity-40">
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full bg-[var(--color-accent)]"
              style={{ height: `${20 + (i % 5) * 12}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-sm hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <a
          href={url}
          download
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Download audio
        </a>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" className="sr-only" />
    </div>
  );
}

function TranscriptMessages({
  transcript,
  active,
  endedLabel,
}: {
  transcript: string | null;
  active: boolean;
  endedLabel: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => parseTranscript(transcript), [transcript]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
      {messages.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] text-center py-8">
          {active
            ? "Waiting for conversation…"
            : "No transcript recorded for this call."}
        </p>
      ) : (
        messages.map((msg, i) => (
          <div key={i} className="mb-3">
            <div
              className={`flex ${msg.speaker === "assistant" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 text-sm shadow-sm ${
                  msg.speaker === "assistant"
                    ? "bg-black/5 dark:bg-white/5"
                    : "bg-black/10 dark:bg-white/15"
                } ${msg.partial ? "opacity-70" : ""}`}
              >
                <div
                  className={`mb-1 text-xs font-medium ${
                    msg.speaker === "assistant"
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-badge-neutral-text)]"
                  }`}
                >
                  {msg.label}
                  {msg.partial ? " · …" : ""}
                </div>
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            </div>
          </div>
        ))
      )}
      {endedLabel && !active && (
        <div className="mt-4 flex justify-center">
          <div className="flex max-w-[85%] items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs">
            <span className="text-[var(--color-danger)]" aria-hidden>
              ✕
            </span>
            <span>Call ended — {endedLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisPanel({ extractedJson }: { extractedJson: string | null }) {
  const data = useMemo(() => {
    if (!extractedJson) return null;
    try {
      return JSON.parse(extractedJson) as StockCheckExtraction;
    } catch {
      return null;
    }
  }, [extractedJson]);

  if (!data) {
    return (
      <div className="flex-1 overflow-y-auto p-4 text-sm text-[var(--color-muted)]">
        No structured analysis yet. Results appear here when the call completes.
      </div>
    );
  }

  const rows: [string, string | undefined][] = [
    ["Status", data.status],
    ["Note", data.note],
    ["Next step", data.nextStep],
    ["Price quoted", data.priceQuoted],
    ["Insurance", data.insuranceAccepted],
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <dl className="space-y-3 text-sm">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt className="text-[var(--color-muted)]">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ) : null
        )}
      </dl>
      <pre className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function VoiceCallViewer({
  voiceCallId: initialCallId,
  onClose,
  onUpdated,
}: VoiceCallViewerProps) {
  const [activeCallId, setActiveCallId] = useState(initialCallId);
  const [call, setCall] = useState<VoiceCallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [tab, setTab] = useState<TabId>("transcripts");
  const [copied, setCopied] = useState(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const prevStatusRef = useRef<VoiceCallStatus | null>(null);
  const notifiedContactLogRef = useRef<string | null>(null);

  const TRANSCRIPT_TAB_ID = "voice-call-tab-transcripts";
  const ANALYSIS_TAB_ID = "voice-call-tab-analysis";
  const TRANSCRIPT_PANEL_ID = "voice-call-panel-transcripts";
  const ANALYSIS_PANEL_ID = "voice-call-panel-analysis";

  useEffect(() => {
    setActiveCallId(initialCallId);
  }, [initialCallId]);

  const load = useCallback(() => {
    api
      .getVoiceCall(activeCallId)
      .then(setCall)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [activeCallId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = isVoiceCallActive(call);
  const awaitingPostCall = isAwaitingPostCallData(call);

  useEffect(() => {
    if (!active && !awaitingPostCall) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [active, awaitingPostCall, load]);

  useEffect(() => {
    if (!call) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = call.status;
    const wasActive =
      prev != null &&
      (prev === "pending" ||
        prev === "queued" ||
        prev === "ringing" ||
        prev === "in_progress");
    const nowTerminal = call.status === "completed" || call.status === "failed";
    if (wasActive && nowTerminal) {
      onUpdated?.();
    }
  }, [call?.status, call, onUpdated]);

  useEffect(() => {
    if (!call?.contactLogId) return;
    if (call.contactLogId === notifiedContactLogRef.current) return;
    notifiedContactLogRef.current = call.contactLogId;
    onUpdated?.();
  }, [call?.contactLogId, onUpdated]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowEndCallConfirm(false);
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previouslyFocusedRef.current = prev;
    const panel = panelRef.current;
    queueMicrotask(() => {
      const sel =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const first = panel?.querySelector<HTMLElement>(sel);
      first?.focus({ preventScroll: true });
    });

    function focusableInPanel(): HTMLElement[] {
      if (!panel) return [];
      const sel =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(panel.querySelectorAll<HTMLElement>(sel)).filter(
        (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panel) return;
      const items = focusableInPanel();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    panel?.addEventListener("keydown", onKeyDown);
    return () => {
      panel?.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!active) setShowEndCallConfirm(false);
  }, [active]);

  const siblingIds = call?.siblingCallIds ?? [];
  const currentIndex = siblingIds.indexOf(activeCallId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < siblingIds.length - 1;

  const duration =
    call?.durationSeconds ??
    (call && !active
      ? Math.max(
          0,
          Math.round(
            (new Date(call.updatedAt).getTime() -
              new Date(call.createdAt).getTime()) /
              1000
          )
        )
      : null);

  const endedLabel =
    formatEndedReason(call?.endedReason) ??
    (call?.errorMessage && call.status === "failed"
      ? formatEndedReason(call.errorMessage)
      : null);

  async function handleConfirmEndCall() {
    setCancelling(true);
    setError(null);
    try {
      const updated = await api.cancelVoiceCall(activeCallId);
      setCall((prev) => (prev ? { ...prev, ...updated } : prev));
      setShowEndCallConfirm(false);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel call");
    } finally {
      setCancelling(false);
    }
  }

  async function copyId() {
    if (!call) return;
    try {
      await navigator.clipboard.writeText(call.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const headerDate = call
    ? new Date(call.createdAt).toLocaleString(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const pharmacyName = call?.pharmacy.name ?? "Pharmacy";
  const phoneDisplay = call?.pharmacy.phone
    ? formatPhoneForDisplay(call.pharmacy.phone)
    : null;

  const drawer = (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        role="presentation"
        className="absolute inset-0 cursor-default bg-black/40 voice-drawer-backdrop"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-call-viewer-title"
        className="voice-drawer-panel relative flex h-full w-full max-w-full flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-xl md:max-w-[70%] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            setShowEndCallConfirm(false);
            onClose();
          }}
          className="absolute right-4 top-4 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-md opacity-70 hover:opacity-100 hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          aria-label="Close"
        >
          <IconClose />
        </button>

        <header className="shrink-0 border-b border-[var(--color-border)] px-4 pb-3 pt-4 pr-12">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2
                id="voice-call-viewer-title"
                className="text-base font-normal truncate"
              >
                {headerDate || "Call"}{" "}
                <span className="text-[var(--color-muted)]">Outbound call</span>
              </h2>
              <span className="inline-flex items-center rounded-md border border-transparent bg-[var(--color-border)] px-2 py-0.5 text-xs font-semibold">
                Assistant
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => hasPrev && setActiveCallId(siblingIds[currentIndex - 1]!)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-[var(--color-border)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                aria-label="Previous call"
              >
                <IconChevron up />
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => hasNext && setActiveCallId(siblingIds[currentIndex + 1]!)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-[var(--color-border)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                aria-label="Next call"
              >
                <IconChevron />
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <IconPhone />
                Customer: {pharmacyName}
                {phoneDisplay ? ` · ${phoneDisplay}` : ""}
              </span>
              {call && (
                <span>
                  {active
                    ? VOICE_CALL_LABELS[call.status]
                    : endedLabel
                      ? `Ended: ${endedLabel}`
                      : VOICE_CALL_LABELS[call.status]}
                </span>
              )}
            </div>
            {duration != null && (
              <span className="inline-flex items-center gap-1">
                <IconClock />
                Duration: {formatCallDuration(duration)}
              </span>
            )}
          </div>

          {call && (
            <div className="mt-1 flex items-center gap-1 font-mono text-xs text-[var(--color-muted)]">
              <span title={call.id}>
                {call.id.slice(0, 13)}…
              </span>
              <button
                type="button"
                onClick={copyId}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                aria-label="Copy call ID"
              >
                <IconCopy />
              </button>
              {copied && (
                <span className="text-[var(--color-accent)]">Copied</span>
              )}
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm font-medium text-[var(--color-danger)]">{error}</p>
          )}
        </header>

        {call?.recordingUrl && (
          <div className="shrink-0 border-b border-[var(--color-border)]">
            <CallRecordingPlayer
              url={call.recordingUrl}
              durationSeconds={call.durationSeconds}
            />
          </div>
        )}

        {active && (
          <div className="shrink-0 flex flex-col gap-2 border-b border-[var(--color-border)] px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {!showEndCallConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowEndCallConfirm(true)}
                  disabled={cancelling}
                  className="min-h-11 rounded-lg border border-[var(--color-danger)] px-3 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
                >
                  End call
                </button>
              ) : (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                  role="group"
                  aria-label="Confirm end call"
                >
                  <span className="text-[var(--color-ink)]">
                    Disconnect the pharmacy line now?
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs font-medium hover:bg-[var(--color-accent-soft)]"
                    onClick={() => setShowEndCallConfirm(false)}
                    disabled={cancelling}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-2 py-1.5 text-xs font-semibold text-[var(--color-danger)] hover:opacity-85 disabled:opacity-50"
                    onClick={handleConfirmEndCall}
                    disabled={cancelling}
                  >
                    {cancelling ? "Ending…" : "End call"}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={load}
                disabled={cancelling}
                className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm hover:bg-[var(--color-accent-soft)] disabled:opacity-50"
              >
                Refresh
              </button>
              <span className="self-center text-xs text-[var(--color-muted)]">
                Live · updates every 2s
              </span>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            role="tablist"
            aria-label="Call details"
            className="flex shrink-0 border-b border-[var(--color-border)] px-4"
          >
            {(
              [
                ["transcripts", TRANSCRIPT_TAB_ID, TRANSCRIPT_PANEL_ID, "Transcripts"],
                ["analysis", ANALYSIS_TAB_ID, ANALYSIS_PANEL_ID, "Analysis"],
              ] as const
            ).map(([id, tabId, panelId, label]) => (
              <button
                key={id}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={panelId}
                onClick={() => setTab(id)}
                className={`min-h-11 px-4 py-3 text-sm font-medium transition-colors relative top-px border-b-2 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] ${
                  tab === id
                    ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                    : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!call && !error ? (
            <p className="p-4 text-sm text-[var(--color-muted)]">Loading call…</p>
          ) : (
            <>
              {tab === "transcripts" && (
                <div
                  id={TRANSCRIPT_PANEL_ID}
                  role="tabpanel"
                  aria-labelledby={TRANSCRIPT_TAB_ID}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <TranscriptMessages
                    transcript={call?.transcript ?? null}
                    active={active}
                    endedLabel={endedLabel}
                  />
                </div>
              )}
              {tab === "analysis" && (
                <div
                  id={ANALYSIS_PANEL_ID}
                  role="tabpanel"
                  aria-labelledby={ANALYSIS_TAB_ID}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <AnalysisPanel extractedJson={call?.extractedJson ?? null} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
