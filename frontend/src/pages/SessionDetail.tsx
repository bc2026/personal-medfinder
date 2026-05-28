import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { PharmacyCard } from "../components/PharmacyCard";
import { latestStatus, STATUS_LABELS } from "../lib/status";
import type { PharmacyStatus, SearchSession } from "../types";

type SortKey = "distance" | "status" | "updated";

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

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .getSession(id)
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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
    return <p className="text-[var(--color-muted)]">Loading session…</p>;
  }

  if (error || !session) {
    return (
      <p className="text-red-600">
        {error ?? "Session not found"}{" "}
        <Link to="/" className="underline">
          Back to dashboard
        </Link>
      </p>
    );
  }

  const inStock = session.pharmacies.filter(
    (p) => latestStatus(p.contactLogs) === "in_stock"
  ).length;

  return (
    <div>
      <Link
        to="/"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{session.medicationName}</h1>
          <p className="text-[var(--color-muted)] mt-1">
            {[session.strength, session.quantity].filter(Boolean).join(" · ") ||
              "No strength/qty"}
            {" · "}ZIP {session.zipCode} · {session.radius} mi radius
          </p>
          {session.userNotes && (
            <p className="mt-2 text-sm italic text-[var(--color-muted)]">
              {session.userNotes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => api.exportSessionJson(session.id)}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)]"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-2 text-sm rounded-lg border border-red-300 text-red-700 dark:text-red-300"
          >
            Delete
          </button>
        </div>
      </div>

      {toast && (
        <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm">
          {toast}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <DisclaimerBanner />

      <p className="mb-4 text-sm text-[var(--color-muted)]">
        {session.pharmacies.length} pharmacies · {inStock} marked in stock
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Filter pharmacies…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PharmacyStatus | "all")
          }
          className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
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
          className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="distance">Sort: distance</option>
          <option value="status">Sort: status</option>
          <option value="updated">Sort: last updated</option>
        </select>
      </div>

      <div className="space-y-3">
        {pharmacies.length === 0 ? (
          <p className="text-[var(--color-muted)]">No pharmacies match filters.</p>
        ) : (
          pharmacies.map((p) => (
            <PharmacyCard
              key={p.id}
              sessionId={session.id}
              pharmacy={p}
              onUpdated={load}
            />
          ))
        )}
      </div>
    </div>
  );
}
