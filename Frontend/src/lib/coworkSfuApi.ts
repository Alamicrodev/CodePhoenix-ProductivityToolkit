import { apiRequest } from "./api";

// Client for the backend's SFU proxy (app/api/routes/cowork_sfu.py). The
// browser never calls Cloudflare's API directly — only media flows to the edge.

// Shapes Cloudflare returns through the proxy. Loosely typed on purpose: the
// browser hands sessionDescription straight to setRemoteDescription.
export interface SfuSessionDescription {
  type: "offer" | "answer";
  sdp: string;
}

export interface SfuTrackResult {
  mid?: string | null;
  trackName?: string;
  sessionId?: string;
  error?: unknown;
}

export interface SfuTracksResponse {
  sessionDescription?: SfuSessionDescription;
  requiresImmediateRenegotiation?: boolean;
  tracks?: SfuTrackResult[];
}

export interface LocalTrackDescriptor {
  location: "local";
  mid: string;
  trackName: string;
}

export const coworkSfuApi = {
  createSession: (token: string, slug: string, bootstrapOffer?: SfuSessionDescription) =>
    apiRequest<{ session_id: string; session_description: SfuSessionDescription | null }>(
      `/cowork-sessions/${slug}/sfu/session`,
      {
        method: "POST",
        token,
        body: JSON.stringify(bootstrapOffer ? { session_description: bootstrapOffer } : {}),
      },
    ),

  publish: (
    token: string,
    slug: string,
    sessionId: string,
    offer: SfuSessionDescription,
    tracks: LocalTrackDescriptor[],
  ) =>
    apiRequest<SfuTracksResponse>(`/cowork-sessions/${slug}/sfu/publish`, {
      method: "POST",
      token,
      body: JSON.stringify({ session_id: sessionId, session_description: offer, tracks }),
    }),

  subscribe: (token: string, slug: string, sessionId: string, remoteSessionId: string, trackNames: string[]) =>
    apiRequest<SfuTracksResponse>(`/cowork-sessions/${slug}/sfu/subscribe`, {
      method: "POST",
      token,
      body: JSON.stringify({
        session_id: sessionId,
        remote_session_id: remoteSessionId,
        track_names: trackNames,
      }),
    }),

  renegotiate: (token: string, slug: string, sessionId: string, answer: SfuSessionDescription) =>
    apiRequest<Record<string, unknown>>(`/cowork-sessions/${slug}/sfu/renegotiate`, {
      method: "PUT",
      token,
      body: JSON.stringify({ session_id: sessionId, session_description: answer }),
    }),
};
