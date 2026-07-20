import { apiRequest } from "./api";

// Mirrors CoworkSessionResponse on the backend (snake_case straight off the wire,
// matching how DataContext handles its own API payloads).
export interface ApiCoworkSession {
  id: string;
  slug: string;
  title: string;
  status: "open" | "ended";
  host_user_id: string;
  host_name: string;
  is_host: boolean;
  participant_count: number;
  created_at: string;
  expires_at: string;
  ended_at: string | null;
}

export interface ApiIceServer {
  urls: string[];
  username: string | null;
  credential: string | null;
}

export interface ApiIceConfig {
  ice_servers: ApiIceServer[];
  has_turn: boolean;
}

export const coworkApi = {
  list: (token: string) => apiRequest<ApiCoworkSession[]>("/cowork-sessions", { token }),
  create: (token: string, title?: string) =>
    apiRequest<ApiCoworkSession>("/cowork-sessions", {
      method: "POST",
      token,
      body: JSON.stringify({ title: title || null }),
    }),
  get: (token: string, slug: string) => apiRequest<ApiCoworkSession>(`/cowork-sessions/${slug}`, { token }),
  end: (token: string, slug: string) =>
    apiRequest<ApiCoworkSession>(`/cowork-sessions/${slug}/end`, { method: "POST", token }),
  iceConfig: (token: string) => apiRequest<ApiIceConfig>("/cowork-sessions/ice-config", { token }),
};

// The link a host actually shares. Built from the browser origin so it works in
// dev, on a preview deploy, and in production without extra configuration.
export function buildShareLink(slug: string) {
  return `${window.location.origin}/cowork/${slug}`;
}
