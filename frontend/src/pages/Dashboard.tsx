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
    return (
      <p className="text-[var(--color-muted)] page-enter">Loading dashboard…</p>
    );
  }

  if (error) {
    return (
      <div className="card border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-5 text-[var(--color-danger)] page-enter">
        <p className="font-display font-semibold text-lg">Could not reach API</p>
        <p className="mt-2 text-sm opacity-90">
          Start the backend with <code className="text-xs font-mono">npm run dev</code> in{" "}
          <code className="text-xs font-mono">backend/</code>, or run{" "}
          <code className="text-xs font-mono">npm run docker:up</code>.
        </p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-lead">
            Track outreach across all medication searches — calls, notes, and stock
            signals in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 page-enter stagger-2">
          <button
            type="button"
            onClick={() => api.exportAllCsv()}
            className="btn-secondary"
          >
            Export all CSV
          </button>
          <Link to="/search/new" className="btn-primary">
            New search
          </Link>
        </div>
      </div>

      <DisclaimerBanner />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10 page-enter stagger-3">
          <StatCard label="Sessions" value={stats.totalSessions} />
          <StatCard label="Pharmacies found" value={stats.pharmaciesFound} />
          <StatCard label="Contacted" value={stats.pharmaciesContacted} />
          <StatCard label="In stock" value={stats.inStock} accent />
          <StatCard
            label="Pending follow-up"
            value={stats.pendingFollowUp}
            hint={`${stats.outOfStock} marked out of stock`}
          />
        </div>
      )}

      <section className="page-enter stagger-4">
        <h2 className="font-display text-xl font-semibold mb-4">Search history</h2>
        {sessions.length === 0 ? (
          <div className="card border-dashed p-10 sm:p-12 text-center">
            <p className="font-display text-lg text-[var(--color-muted)]">
              No searches yet
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)] max-w-sm mx-auto">
              Start by finding pharmacies near a ZIP code, then log what you learn
              from each call.
            </p>
            <Link to="/search/new" className="btn-primary mt-6 inline-flex">
              Start your first search
            </Link>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {sessions.map((s, i) => (
              <li
                key={s.id}
                className="page-enter-fade"
                style={{ animationDelay: `${0.05 * Math.min(i, 8)}s` }}
              >
                <Link
                  to={`/sessions/${s.id}`}
                  className="card-interactive flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold truncate">
                      {s.medicationName}
                      {s.strength && (
                        <span className="text-[var(--color-muted)] font-normal text-base">
                          {" "}
                          · {s.strength}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--color-muted)] mt-0.5">
                      ZIP {s.zipCode} ·{" "}
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-sm text-right shrink-0">
                    <span className="font-semibold text-[var(--color-accent)]">
                      {s.inStockCount} in stock
                    </span>
                    <span className="text-[var(--color-muted)]">
                      {" "}
                      · {s.contactedCount}/{s.pharmacyCount} contacted
                    </span>
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
