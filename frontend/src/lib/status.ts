import type { PharmacyStatus } from "../types";

export const STATUS_LABELS: Record<PharmacyStatus, string> = {
  not_contacted: "Not contacted",
  called: "Called",
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  partial_stock: "Partial stock",
  will_order: "Will order",
  left_voicemail: "Left voicemail",
};

export const STATUS_OPTIONS: PharmacyStatus[] = [
  "not_contacted",
  "called",
  "in_stock",
  "out_of_stock",
  "partial_stock",
  "will_order",
  "left_voicemail",
];

export function statusBadgeClass(status: PharmacyStatus): string {
  switch (status) {
    case "in_stock":
      return "bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20";
    case "out_of_stock":
      return "bg-[var(--color-danger-bg)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/15";
    case "partial_stock":
      return "bg-[var(--color-warning-bg)] text-[#8a6914] dark:text-[#d4a83a] ring-1 ring-[var(--color-warning-border)]/30";
    case "called":
    case "left_voicemail":
    case "will_order":
      return "bg-[var(--color-badge-neutral-bg)] text-[var(--color-badge-neutral-text)] ring-1 ring-[var(--color-badge-neutral-ring)]";
    default:
      return "bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-[var(--color-border)]";
  }
}

export function latestStatus(
  logs: { status: PharmacyStatus; contactedAt: string }[]
): PharmacyStatus {
  if (!logs.length) return "not_contacted";
  return logs[0].status;
}

/** Marker fill color for map pins */
export function mapMarkerColor(status: PharmacyStatus): string {
  switch (status) {
    case "in_stock":
      return "var(--color-accent)";
    case "partial_stock":
      return "var(--color-warning-border)";
    case "out_of_stock":
      return "var(--color-danger)";
    case "will_order":
      return "var(--color-badge-neutral-text)";
    case "called":
    case "left_voicemail":
      return "var(--color-muted)";
    default:
      return "var(--color-border-strong)";
  }
}

export const STOCK_AVAILABLE_STATUSES: PharmacyStatus[] = [
  "in_stock",
  "partial_stock",
  "will_order",
];

export function hasStockSignal(status: PharmacyStatus): boolean {
  return STOCK_AVAILABLE_STATUSES.includes(status);
}
