export type PharmacyStatus =
  | "not_contacted"
  | "called"
  | "in_stock"
  | "out_of_stock"
  | "partial_stock"
  | "will_order"
  | "left_voicemail";

export interface ContactLog {
  id: string;
  pharmacyId: string;
  status: PharmacyStatus;
  note: string | null;
  nextStep: string | null;
  priceQuoted: string | null;
  insuranceAccepted: string | null;
  contactedAt: string;
}

export interface Pharmacy {
  id: string;
  searchSessionId: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles: number | null;
  source: string;
  contactLogs: ContactLog[];
}

export interface SearchSession {
  id: string;
  medicationName: string;
  strength: string | null;
  quantity: string | null;
  zipCode: string;
  radius: number;
  userNotes: string | null;
  createdAt: string;
  updatedAt: string;
  pharmacies: Pharmacy[];
}

export interface SessionSummary {
  id: string;
  medicationName: string;
  strength: string | null;
  zipCode: string;
  createdAt: string;
  pharmacyCount: number;
  contactedCount: number;
  inStockCount: number;
}

export interface DashboardStats {
  totalSessions: number;
  pharmaciesFound: number;
  pharmaciesContacted: number;
  inStock: number;
  outOfStock: number;
  pendingFollowUp: number;
}

export interface CreateSearchInput {
  medicationName: string;
  strength?: string;
  quantity?: string;
  zipCode: string;
  radius: number;
  userNotes?: string;
}

export interface ContactLogInput {
  status: PharmacyStatus;
  note?: string;
  nextStep?: string;
  priceQuoted?: string;
  insuranceAccepted?: "yes" | "no" | "unknown";
}
