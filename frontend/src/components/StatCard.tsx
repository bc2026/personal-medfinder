interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>
      )}
    </div>
  );
}
