import { useState } from "react";
import { api } from "../api/client";
import { latestStatus, STATUS_LABELS, statusBadgeClass, STATUS_OPTIONS } from "../lib/status";
import {
  formatPhoneForDisplay,
  isDialableForVoice,
  phoneTelHref,
} from "../lib/phone";
import {
  isVoiceCallActive,
  latestVoiceCall,
  VOICE_CALL_LABELS,
} from "../lib/voiceCall";
import { VoiceCallViewer } from "./VoiceCallViewer";
import type { ContactLogInput, Pharmacy, PharmacyStatus } from "../types";

interface PharmacyCardProps {
  sessionId: string;
  pharmacy: Pharmacy;
  voiceAgentEnabled: boolean;
  onUpdated: () => void;
}

export function PharmacyCard({
  sessionId,
  pharmacy,
  voiceAgentEnabled,
  onUpdated,
}: PharmacyCardProps) {
  const status = latestStatus(pharmacy.contactLogs);
  const latestLog = pharmacy.contactLogs[0];
  const voiceCall = latestVoiceCall(pharmacy.voiceCalls);
  const voiceActive = isVoiceCallActive(voiceCall);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calling, setCalling] = useState(false);
  const [viewingCallId, setViewingCallId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactLogInput>({
    status,
    note: latestLog?.note ?? "",
    nextStep: latestLog?.nextStep ?? "",
    priceQuoted: latestLog?.priceQuoted ?? "",
    insuranceAccepted:
      (latestLog?.insuranceAccepted as ContactLogInput["insuranceAccepted"]) ??
      undefined,
  });

  const mapsQuery = encodeURIComponent(
    `${pharmacy.name} ${pharmacy.address}`
  );
  const phoneDisplay = pharmacy.phone
    ? formatPhoneForDisplay(pharmacy.phone)
    : null;
  const phoneHref = pharmacy.phone ? phoneTelHref(pharmacy.phone) : null;
  const voiceDialable =
    pharmacy.phone != null && isDialableForVoice(pharmacy.phone);

  async function handleVoiceCall() {
    if (!pharmacy.phone) return;
    if (
      !confirm(
        `Start an AI voice call to ${pharmacy.name} to ask about medication stock?`
      )
    ) {
      return;
    }
    setCalling(true);
    try {
      const started = await api.startVoiceCall(sessionId, pharmacy.id);
      onUpdated();
      setViewingCallId(started.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start voice call");
    } finally {
      setCalling(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.logContact(sessionId, pharmacy.id, form);
      setExpanded(false);
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">{pharmacy.name}</h3>
          <p className="text-sm text-[var(--color-muted)] mt-0.5 leading-snug">
            {pharmacy.address}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {pharmacy.distanceMiles != null && (
              <span className="text-[var(--color-muted)] tabular-nums">
                {pharmacy.distanceMiles} mi
              </span>
            )}
            {phoneDisplay && phoneHref && (
              <a href={phoneHref} className="link-accent">
                {phoneDisplay}
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
              className="link-accent"
            >
              Maps ↗
            </a>
          </div>
          {pharmacy.availableMedications && pharmacy.availableMedications.length > 0 && (
            <ul className="mt-2.5 space-y-0.5">
              {pharmacy.availableMedications.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm">
                  <span className="mt-0.5 shrink-0 text-[var(--color-success)]">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {latestLog?.note && !expanded && (
            <p className="mt-2.5 text-sm line-clamp-2 text-[var(--color-muted)] leading-relaxed">
              {latestLog.note}
            </p>
          )}
          {latestLog?.contactedAt && (
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">
              Last updated{" "}
              {new Date(latestLog.contactedAt).toLocaleString()}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${statusBadgeClass(status)}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {voiceCall && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs rounded-lg bg-[var(--color-surface)] px-3 py-2">
          <p
            className={
              voiceCall.status === "failed"
                ? "text-[var(--color-danger)] font-medium"
                : "text-[var(--color-muted)]"
            }
          >
            Voice: {VOICE_CALL_LABELS[voiceCall.status]}
            {voiceCall.errorMessage ? ` — ${voiceCall.errorMessage}` : ""}
          </p>
          {(voiceActive ||
            voiceCall.transcript ||
            voiceCall.status === "completed") && (
            <button
              type="button"
              onClick={() => setViewingCallId(voiceCall.id)}
              className="link-accent text-xs"
            >
              {voiceActive ? "View live call" : "View transcript"}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 border-t border-[var(--color-border)] pt-3">
        {voiceAgentEnabled && pharmacy.phone && voiceDialable && (
          <button
            type="button"
            onClick={handleVoiceCall}
            disabled={calling || voiceActive}
            className="link-accent text-sm disabled:opacity-50 disabled:no-underline"
          >
            {calling || voiceActive ? "Calling…" : "AI call to check stock"}
          </button>
        )}
        {voiceAgentEnabled && pharmacy.phone && !voiceDialable && (
          <span className="text-sm text-[var(--color-muted)]">
            Phone not dialable (placeholder or 555-xxxx)
          </span>
        )}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="link-accent text-sm"
        >
          {expanded ? "Cancel" : "Update status & notes"}
        </button>
      </div>

      {viewingCallId && (
        <VoiceCallViewer
          voiceCallId={viewingCallId}
          onUpdated={onUpdated}
          onClose={() => {
            setViewingCallId(null);
            onUpdated();
          }}
        />
      )}

      {expanded && (
        <form
          onSubmit={handleSave}
          className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4"
        >
          <label className="block text-sm">
            <span className="font-semibold text-[var(--color-muted)]">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as PharmacyStatus })
              }
              className="input"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-[var(--color-muted)]">Notes</span>
            <textarea
              value={form.note ?? ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              className="input resize-y"
              placeholder="Transfer policy, hours, insurance…"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold text-[var(--color-muted)]">Next step</span>
              <input
                value={form.nextStep ?? ""}
                onChange={(e) =>
                  setForm({ ...form, nextStep: e.target.value })
                }
                className="input"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-[var(--color-muted)]">Price quoted</span>
              <input
                value={form.priceQuoted ?? ""}
                onChange={(e) =>
                  setForm({ ...form, priceQuoted: e.target.value })
                }
                className="input"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-semibold text-[var(--color-muted)]">
              Insurance accepted
            </span>
            <select
              value={form.insuranceAccepted ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  insuranceAccepted: (e.target.value ||
                    undefined) as ContactLogInput["insuranceAccepted"],
                })
              }
              className="input"
            >
              <option value="">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save contact log"}
          </button>
        </form>
      )}
    </article>
  );
}
