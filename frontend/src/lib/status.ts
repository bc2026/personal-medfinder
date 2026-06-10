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
      return "bg-[#e8eef5] text-[#3d5a73] dark:bg-[#1a2835] dark:text-[#8eb4d4] ring-1 ring-[#3d5a73]/10";
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
      return "#1b6b5a";
    case "partial_stock":
      return "#c9a227";
    case "out_of_stock":
      return "#9b2c2c";
    case "will_order":
      return "#3d5a73";
    case "called":
    case "left_voicemail":
      return "#5c6b65";
    default:
      return "#b8b0a2";
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
