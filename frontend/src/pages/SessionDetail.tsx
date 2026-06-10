import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { PharmacyCard } from "../components/PharmacyCard";
import { StockMap } from "../components/StockMap";
import { hasStockSignal, latestStatus, STATUS_LABELS } from "../lib/status";
import {
  sessionNeedsVoiceRefresh,
} from "../lib/voiceCall";
import type { PharmacyStatus, SearchSession } from "../types";

type SortKey = "distance" | "status" | "updated";
type ViewMode = "list" | "map" | "split";

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SearchSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<PharmacyStatus | "all">(
    "all"
  );
  const [sort, setSort] = useState<SortKey>("distance");
  const [voiceAgentEnabled, setVoiceAgentEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [mapStockOnly, setMapStockOnly] = useState(false);

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!id) return;
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    api
      .getSession(id)
      .then((data) => {
        setSession(data);
        setError(null);
      })
      .catch((e) => {
        if (!silent) setError(e.message);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    api.getVoiceConfig().then((c) => setVoiceAgentEnabled(c.enabled));
  }, []);

  const needsVoiceRefresh = useMemo(
    () => sessionNeedsVoiceRefresh(session),
    [session]
  );

  useEffect(() => {
    if (!needsVoiceRefresh || !id) return;
    const timer = setInterval(() => load({ silent: true }), 3000);
    return () => clearInterval(timer);
  }, [needsVoiceRefresh, id, load]);

  useEffect(() => {
    load();
    const msg = sessionStorage.getItem("medfinder-toast");
    if (msg) {
      setToast(msg);
      sessionStorage.removeItem("medfinder-toast");
    }
  }, [load]);

  const pharmacies = useMemo(() => {
    if (!session) return [];
    let list = [...session.pharmacies];

    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((p) => latestStatus(p.contactLogs) === statusFilter);
    }

    list.sort((a, b) => {
      if (sort === "distance") {
        return (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99);
      }
      if (sort === "status") {
        return latestStatus(a.contactLogs).localeCompare(
          latestStatus(b.contactLogs)
        );
      }
      const at = a.contactLogs[0]?.contactedAt ?? "";
      const bt = b.contactLogs[0]?.contactedAt ?? "";
      return bt.localeCompare(at);
    });

    return list;
  }, [session, filter, statusFilter, sort]);

  async function handleDelete() {
    if (!id || !confirm("Delete this search session and all logs?")) return;
    await api.deleteSession(id);
    window.location.href = "/";
  }

  if (loading) {
    return (
      <p className="text-[var(--color-muted)] page-enter">Loading session…</p>
    );
  }

  if (error || !session) {
    return (
      <div className="page-enter">
        <p className="text-[var(--color-danger)] font-medium">
          {error ?? "Session not found"}
        </p>
        <Link to="/" className="link-accent mt-3 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const inStock = session.pharmacies.filter(
    (p) => latestStatus(p.contactLogs) === "in_stock"
  ).length;
  const stockSignals = session.pharmacies.filter((p) =>
    hasStockSignal(latestStatus(p.contactLogs))
  ).length;

  const viewToggle = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="segmented" role="group" aria-label="View mode">
        {(
          [
            ["list", "List"],
            ["map", "Map"],
            ["split", "Split"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className="segmented-btn"
            data-active={viewMode === mode ? "true" : "false"}
          >
            {label}
          </button>
        ))}
      </div>
      {(viewMode === "map" || viewMode === "split") && (
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={mapStockOnly}
            onChange={(e) => setMapStockOnly(e.target.checked)}
            className="rounded border-[var(--color-border-strong)] accent-[var(--color-accent)]"
          />
          Stock on map only
        </label>
      )}
    </div>
  );

  return (
    <div className="page-enter">
      <Link to="/" className="link-back">
        <span aria-hidden>←</span> Dashboard
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{session.medicationName}</h1>
          <p className="page-lead !mt-1.5">
            {[session.strength, session.quantity].filter(Boolean).join(" · ") ||
              "No strength/qty"}
            {" · "}ZIP {session.zipCode} · {session.radius} mi radius
          </p>
          {session.userNotes && (
            <p className="mt-3 text-sm text-[var(--color-muted)] border-l-2 border-[var(--color-border-strong)] pl-3 italic">
              {session.userNotes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => api.exportSessionJson(session.id)}
            className="btn-secondary"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="btn px-4 py-2 border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
          >
            Delete
          </button>
        </div>
      </div>

      {toast && (
        <div className="mt-5 card border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm flex flex-wrap items-start justify-between gap-2">
          <span>{toast}</span>
          <button
            type="button"
            className="link-accent text-xs shrink-0"
            onClick={() => setToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-6">
        <DisclaimerBanner />
      </div>

      {voiceAgentEnabled && (
        <p className="mb-5 text-sm text-[var(--color-muted)] card px-4 py-3 border-l-4 border-l-[var(--color-accent)]">
          Voice agent is on — use{" "}
          <strong className="text-[var(--color-ink)] font-semibold">
            AI call to check stock
          </strong>{" "}
          on each pharmacy. Results are written to contact logs when the call ends.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-muted)]">
          <span className="font-semibold text-[var(--color-ink)]">
            {session.pharmacies.length}
          </span>{" "}
          pharmacies ·{" "}
          <span className="font-semibold text-[var(--color-accent)]">{inStock}</span>{" "}
          in stock · {stockSignals} stock signals
        </p>
        {viewToggle}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Filter pharmacies…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input flex-1 min-w-[180px] !mt-0 text-sm py-2"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PharmacyStatus | "all")
          }
          className="input !mt-0 text-sm py-2 w-auto min-w-[10rem]"
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as PharmacyStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input !mt-0 text-sm py-2 w-auto min-w-[10rem]"
        >
          <option value="distance">Sort: distance</option>
          <option value="status">Sort: status</option>
          <option value="updated">Sort: last updated</option>
        </select>
      </div>

      {viewMode === "map" && (
        <StockMap
          pharmacies={pharmacies}
          stockOnly={mapStockOnly}
          embedded
          className="mb-4 card overflow-hidden p-4"
        />
      )}

      {viewMode === "split" && (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start mb-6">
          <StockMap
            pharmacies={pharmacies}
            stockOnly={mapStockOnly}
            embedded
            className="card min-w-0 overflow-hidden p-4 isolate z-0"
          />
          <div
            className="relative z-10 flex min-h-0 flex-col gap-3 lg:max-h-[min(420px,calc(100dvh-11rem))] lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1"
          >
            {pharmacies.length === 0 ? (
              <p className="text-[var(--color-muted)]">
                No pharmacies match filters.
              </p>
            ) : (
              pharmacies.map((p) => (
                <PharmacyCard
                  key={p.id}
                  sessionId={session.id}
                  pharmacy={p}
                  voiceAgentEnabled={voiceAgentEnabled}
                  onUpdated={() => load({ silent: true })}
                />
              ))
            )}
          </div>
        </div>
      )}

      {viewMode === "list" && (
        <div className="space-y-3">
          {pharmacies.length === 0 ? (
            <p className="text-[var(--color-muted)]">
              No pharmacies match filters.
            </p>
          ) : (
            pharmacies.map((p) => (
              <PharmacyCard
                key={p.id}
                sessionId={session.id}
                pharmacy={p}
                voiceAgentEnabled={voiceAgentEnabled}
                onUpdated={() => load({ silent: true })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
