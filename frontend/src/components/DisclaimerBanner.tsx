export function DisclaimerBanner() {
  return (
    <div
      role="note"
      className="mb-6 rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-ink)]"
    >
      <strong className="font-medium">Important:</strong> This tool helps you
      organize pharmacy outreach. It does <em>not</em> provide guaranteed or
      real-time medication inventory. Always confirm availability, price, and
      transfer policies by phone.
    </div>
  );
}
