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

export type VoiceCallStatus =
  | "pending"
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed";

export interface VoiceCall {
  id: string;
  pharmacyId: string;
  provider: string;
  externalId: string | null;
  listenUrl: string | null;
  status: VoiceCallStatus;
  errorMessage: string | null;
  transcript: string | null;
  extractedJson: string | null;
  contactLogId: string | null;
  endedReason: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceCallPharmacy {
  id: string;
  name: string;
  phone: string | null;
  searchSessionId: string;
}

export interface VoiceCallDetail extends VoiceCall {
  pharmacy: VoiceCallPharmacy;
  siblingCallIds: string[];
}

export interface StockCheckExtraction {
  status: string;
  note?: string;
  nextStep?: string;
  priceQuoted?: string;
  insuranceAccepted?: string;
}

export interface VoiceAgentConfig {
  enabled: boolean;
  provider: string;
  hasAssistantId: boolean;
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
  availableMedications: string[] | null;
  contactLogs: ContactLog[];
  voiceCalls?: VoiceCall[];
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
