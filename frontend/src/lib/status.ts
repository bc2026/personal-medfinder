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
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "out_of_stock":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "partial_stock":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "called":
    case "left_voicemail":
    case "will_order":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
}

export function latestStatus(
  logs: { status: PharmacyStatus; contactedAt: string }[]
): PharmacyStatus {
  if (!logs.length) return "not_contacted";
  return logs[0].status;
}
