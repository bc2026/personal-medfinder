import type {
  ContactLogInput,
  CreateSearchInput,
  DashboardStats,
  SearchSession,
  SessionSummary,
  VoiceAgentConfig,
  VoiceCall,
  VoiceCallDetail,
} from "../types";

const BASE = "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getDashboard: () => request<DashboardStats>("/api/sessions/dashboard"),

  listSessions: () => request<SessionSummary[]>("/api/sessions"),

  getSession: (id: string) => request<SearchSession>(`/api/sessions/${id}`),

  createSession: (data: CreateSearchInput) =>
    request<{ session: SearchSession; usedFallback: boolean }>(
      "/api/sessions",
      { method: "POST", body: JSON.stringify(data) }
    ),

  logContact: (
    sessionId: string,
    pharmacyId: string,
    data: ContactLogInput
  ) =>
    request(`/api/sessions/${sessionId}/pharmacies/${pharmacyId}/contact`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteSession: (id: string) =>
    request<void>(`/api/sessions/${id}`, { method: "DELETE" }),

  exportSessionJson: (id: string) => {
    window.open(`/api/sessions/${id}/export`, "_blank");
  },

  exportAllCsv: () => {
    window.open("/api/sessions/export/all.csv", "_blank");
  },

  getVoiceConfig: () => request<VoiceAgentConfig>("/api/voice/config"),

  startVoiceCall: (sessionId: string, pharmacyId: string) =>
    request<VoiceCall>(
      `/api/voice/sessions/${sessionId}/pharmacies/${pharmacyId}/call`,
      { method: "POST" }
    ),

  getVoiceCall: (voiceCallId: string) =>
    request<VoiceCallDetail>(`/api/voice/calls/${voiceCallId}`),

  cancelVoiceCall: (voiceCallId: string) =>
    request<VoiceCall>(`/api/voice/calls/${voiceCallId}/cancel`, {
      method: "POST",
    }),
};
