import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  const navigate = useNavigate();
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
    api
      .getVoiceConfig()
      .then((c) => setVoiceAgentEnabled(c.enabled))
      .catch(() => {
        // Voice agent stays off; core flows work without it
      });
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

  async function handleConfirmDelete() {
    if (!id) return;
    try {
      await api.deleteSession(id);
      navigate("/");
    } catch (e) {
      setDeleteConfirm(false);
      setToast(e instanceof Error ? `Delete failed: ${e.message}` : "Delete failed");
    }
  }

  if (loading) {
    return (
      <div className="page-enter-fade" role="status" aria-label="Loading session">
        <div className="skeleton h-5 w-28" />
        <div className="skeleton mt-6 h-10 w-72 max-w-full" />
        <div className="skeleton mt-3 h-5 w-96 max-w-full" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-[320px]" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        </div>
      </div>
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
            <p className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm italic text-[var(--color-muted)]">
              {session.userNotes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => api.exportSessionJson(session.id)}
            className="btn-secondary min-h-11"
          >
            Export JSON
          </button>
          {!deleteConfirm ? (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="btn min-h-11 border border-[var(--color-danger)] px-4 py-2 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
            >
              Delete
            </button>
          ) : (
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              role="group"
              aria-label="Confirm delete session"
            >
              <span className="text-[var(--color-ink)]">Delete this session and all logs?</span>
              <button
                type="button"
                className="btn-ghost min-h-11 px-3 text-sm"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn min-h-11 border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-3 text-sm font-semibold text-[var(--color-danger)] hover:opacity-90"
                onClick={handleConfirmDelete}
              >
                Confirm delete
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className="mt-5 card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm flex flex-wrap items-start justify-between gap-2"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
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
        <p className="mb-5 rounded-2xl border border-[var(--color-accent)]/35 bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-muted)]">
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
        <div className="relative flex-1 min-w-[180px]">
          <label htmlFor="pharmacy-filter" className="sr-only">
            Filter pharmacies by name or address
          </label>
          <input
            id="pharmacy-filter"
            type="search"
            placeholder="Filter pharmacies…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input !mt-0 text-sm py-2 min-h-11 w-full"
          />
        </div>
        <select
          aria-label="Filter by stock or contact status"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PharmacyStatus | "all")
          }
          className="input !mt-0 min-h-11 text-sm py-2 w-auto min-w-[10rem]"
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as PharmacyStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort pharmacies"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input !mt-0 min-h-11 text-sm py-2 w-auto min-w-[10rem]"
        >
          <option value="distance">Sort: distance</option>
          <option value="status">Sort: status</option>
          <option value="updated">Sort: last updated</option>
        </select>
      </div>

      <h2 className="sr-only">Pharmacy results</h2>

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
