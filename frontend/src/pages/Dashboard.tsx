import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { StatCard } from "../components/StatCard";
import type { DashboardStats, SessionSummary } from "../types";

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getDashboard(), api.listSessions()])
      .then(([d, s]) => {
        setStats(d);
        setSessions(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-[var(--color-muted)]">Loading dashboard…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 text-red-800 dark:text-red-200">
        Could not reach API. Start the backend with{" "}
        <code className="text-sm">npm run dev</code> in <code>backend/</code>.
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Track outreach across all medication searches.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => api.exportAllCsv()}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Export all CSV
          </button>
          <Link
            to="/search/new"
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)]"
          >
            New search
          </Link>
        </div>
      </div>

      <DisclaimerBanner />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatCard label="Sessions" value={stats.totalSessions} />
          <StatCard label="Pharmacies found" value={stats.pharmaciesFound} />
          <StatCard label="Contacted" value={stats.pharmaciesContacted} />
          <StatCard label="In stock" value={stats.inStock} />
          <StatCard
            label="Pending follow-up"
            value={stats.pendingFollowUp}
            hint={`${stats.outOfStock} marked out of stock`}
          />
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Search history</h2>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
            <p className="text-[var(--color-muted)]">No searches yet.</p>
            <Link
              to="/search/new"
              className="inline-block mt-3 text-[var(--color-accent)] font-medium hover:underline"
            >
              Start your first search →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/sessions/${s.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 hover:border-[var(--color-accent)] transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {s.medicationName}
                      {s.strength && (
                        <span className="text-[var(--color-muted)] font-normal">
                          {" "}
                          · {s.strength}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-muted)]">
                      ZIP {s.zipCode} ·{" "}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-sm text-right text-[var(--color-muted)]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {s.inStockCount} in stock
                    </span>
                    {" · "}
                    {s.contactedCount}/{s.pharmacyCount} contacted
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
