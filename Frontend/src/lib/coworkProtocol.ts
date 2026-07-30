// Message shapes exchanged with /ws/cowork/{slug}. Kept in one place so the
// socket hook, the WebRTC hook, and their tests all agree on the wire format.

export interface SharedTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface CoworkPeer {
  peer_id: string;
  user_id: string;
  display_name: string;
  shared_tasks: SharedTask[];
  // The Cloudflare SFU session this peer publishes through and its track names.
  // Null/empty until they announce media (or if they joined receive-only).
  sfu_session_id: string | null;
  published_tracks: string[];
}

export interface CoworkRoomInfo {
  slug: string;
  title: string;
  host_user_id: string;
}

// Messages the browser sends up. The SDP handshake goes over the REST proxy —
// the socket only announces that tracks exist.
export type OutgoingMessage =
  | { type: "ping" }
  | { type: "task-list"; payload: { tasks: SharedTask[] } }
  | { type: "media-published"; payload: { session_id: string; track_names: string[] } };

// Messages the server sends down.
export type IncomingMessage =
  | {
      type: "welcome";
      payload: {
        peer_id: string;
        room: CoworkRoomInfo;
        max_participants: number;
        peers: CoworkPeer[];
      };
    }
  | { type: "peer-joined"; payload: CoworkPeer }
  | { type: "peer-left"; payload: { peer_id: string } }
  | { type: "room-ended"; payload: { reason: "host-ended" | "expired" } }
  | { type: "task-list"; from: string; payload: { tasks: SharedTask[] } }
  | { type: "media-published"; from: string; payload: { session_id: string; track_names: string[] } }
  | { type: "pong" }
  | { type: "error"; payload: { message: string } };

export type CoworkConnectionState = "connecting" | "connected" | "reconnecting" | "closed";

// Close codes the server uses to explain a rejected connection. Anything else is
// treated as a transient drop worth retrying.
export const CLOSE_CODES = {
  unauthorized: 4401,
  roomFull: 4403,
  roomNotFound: 4404,
  alreadyJoined: 4409,
} as const;

const FATAL_CLOSE_CODES: number[] = [
  CLOSE_CODES.unauthorized,
  CLOSE_CODES.roomFull,
  CLOSE_CODES.roomNotFound,
  CLOSE_CODES.alreadyJoined,
];

// Retrying these would just fail again in a loop — surface them to the user instead.
export function isFatalCloseCode(code: number) {
  return FATAL_CLOSE_CODES.includes(code);
}

export function describeRoomEnded(reason: "host-ended" | "expired") {
  return reason === "expired"
    ? "This room expired and has been closed."
    : "The host ended this room.";
}

export function describeCloseCode(code: number) {
  switch (code) {
    case CLOSE_CODES.unauthorized:
      return "Your session expired. Please sign in again.";
    case CLOSE_CODES.roomFull:
      return "This room is full.";
    case CLOSE_CODES.roomNotFound:
      return "This cowork session has ended.";
    case CLOSE_CODES.alreadyJoined:
      // Sent to the OLDER of two connections from the same user: joining from a
      // new tab (or reconnecting after a network change) replaces this one.
      return "You joined this room in another tab, so this one was disconnected.";
    default:
      return "Lost connection to the room.";
  }
}

export const HEARTBEAT_INTERVAL_MS = 30_000;

// Exponential backoff with jitter: a Render restart drops every socket in the
// room at once, so without jitter they would all stampede back simultaneously.
export function reconnectDelayMs(attempt: number, random: () => number = Math.random) {
  const capped = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
  return Math.round(capped * (0.5 + random() * 0.5));
}
