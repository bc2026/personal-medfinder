interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}

export function StatCard({ label, value, hint, accent }: StatCardProps) {
  return (
    <div
      className={`card p-4 sm:p-5 ${
        accent
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
          : ""
      }`}
    >
      <p className="text-[0.65rem] uppercase tracking-[0.12em] font-semibold text-[var(--color-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight ${
          accent ? "text-[var(--color-accent)]" : ""
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-xs text-[var(--color-muted)] leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
