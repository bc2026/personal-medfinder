import { z } from "zod";

export const PHARMACY_STATUSES = [
  "not_contacted",
  "called",
  "in_stock",
  "out_of_stock",
  "partial_stock",
  "will_order",
  "left_voicemail",
] as const;

export type PharmacyStatus = (typeof PHARMACY_STATUSES)[number];

export const createSearchSchema = z.object({
  medicationName: z.string().min(1).max(200),
  strength: z.string().max(100).optional(),
  quantity: z.string().max(100).optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits or ZIP+4"),
  radius: z.coerce.number().min(1).max(50).default(10),
  userNotes: z.string().max(2000).optional(),
});

export const contactLogSchema = z.object({
  status: z.enum(PHARMACY_STATUSES),
  note: z.string().max(5000).optional(),
  nextStep: z.string().max(500).optional(),
  priceQuoted: z.string().max(100).optional(),
  insuranceAccepted: z.enum(["yes", "no", "unknown"]).optional(),
});
