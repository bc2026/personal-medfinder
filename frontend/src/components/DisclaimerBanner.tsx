export function DisclaimerBanner() {
  return (
    <div
      role="note"
      className="mb-6 rounded-2xl border-l-4 border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3.5 text-sm leading-relaxed page-enter"
    >
      <span className="font-display font-semibold text-[var(--color-ink)]">
        Important
      </span>
      <span className="text-[var(--color-muted)]">
        {" "}
        — This tool helps you organize pharmacy outreach. It does{" "}
        <em className="text-[var(--color-ink)] not-italic font-medium">not</em>{" "}
        provide guaranteed or real-time medication inventory. Always confirm
        availability, price, and transfer policies by phone.
      </span>
    </div>
  );
}
