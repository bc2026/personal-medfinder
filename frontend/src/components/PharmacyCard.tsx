import { useState } from "react";
import { api } from "../api/client";
import { latestStatus, STATUS_LABELS, statusBadgeClass, STATUS_OPTIONS } from "../lib/status";
import type { ContactLogInput, Pharmacy, PharmacyStatus } from "../types";

interface PharmacyCardProps {
  sessionId: string;
  pharmacy: Pharmacy;
  onUpdated: () => void;
}

export function PharmacyCard({ sessionId, pharmacy, onUpdated }: PharmacyCardProps) {
  const status = latestStatus(pharmacy.contactLogs);
  const latestLog = pharmacy.contactLogs[0];
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const tel = pharmacy.phone?.replace(/\D/g, "");

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
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{pharmacy.name}</h3>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {pharmacy.address}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {pharmacy.distanceMiles != null && (
              <span className="text-[var(--color-muted)]">
                {pharmacy.distanceMiles} mi
              </span>
            )}
            {pharmacy.phone && (
              <a
                href={`tel:${tel}`}
                className="text-[var(--color-accent)] hover:underline"
              >
                {pharmacy.phone}
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] hover:underline"
            >
              Maps
            </a>
          </div>
          {latestLog?.note && !expanded && (
            <p className="mt-2 text-sm line-clamp-2 text-[var(--color-muted)]">
              {latestLog.note}
            </p>
          )}
          {latestLog?.contactedAt && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Last updated{" "}
              {new Date(latestLog.contactedAt).toLocaleString()}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass(status)}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        {expanded ? "Cancel" : "Update status & notes"}
      </button>

      {expanded && (
        <form onSubmit={handleSave} className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
          <label className="block text-sm">
            <span className="text-[var(--color-muted)]">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as PharmacyStatus })
              }
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-[var(--color-muted)]">Notes</span>
            <textarea
              value={form.note ?? ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              placeholder="Transfer policy, hours, insurance…"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--color-muted)]">Next step</span>
              <input
                value={form.nextStep ?? ""}
                onChange={(e) =>
                  setForm({ ...form, nextStep: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--color-muted)]">Price quoted</span>
              <input
                value={form.priceQuoted ?? ""}
                onChange={(e) =>
                  setForm({ ...form, priceQuoted: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-[var(--color-muted)]">Insurance accepted</span>
            <select
              value={form.insuranceAccepted ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  insuranceAccepted: (e.target.value ||
                    undefined) as ContactLogInput["insuranceAccepted"],
                })
              }
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
            >
              <option value="">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save contact log"}
          </button>
        </form>
      )}
    </article>
  );
}
