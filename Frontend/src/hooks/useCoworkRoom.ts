import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getWebSocketUrl } from "../lib/api";
import {
  CoworkConnectionState,
  CoworkPeer,
  CoworkRoomInfo,
  HEARTBEAT_INTERVAL_MS,
  IncomingMessage,
  OutgoingMessage,
  SharedTask,
  describeCloseCode,
  describeRoomEnded,
  isFatalCloseCode,
  reconnectDelayMs,
} from "../lib/coworkProtocol";

type MessageHandler = (message: IncomingMessage) => void;

export interface CoworkRoomConnection {
  connectionState: CoworkConnectionState;
  /** Set when the room refused us for a reason retrying cannot fix. */
  fatalError: string | null;
  selfPeerId: string | null;
  room: CoworkRoomInfo | null;
  peers: CoworkPeer[];
  maxParticipants: number;
  shareTasks: (tasks: SharedTask[]) => void;
  /** Tell the room which SFU session/tracks we publish (roster state). */
  announceMedia: (sessionId: string, trackNames: string[]) => void;
  /** Lets the media layer observe raw messages without a second socket. */
  subscribe: (handler: MessageHandler) => () => void;
}

/**
 * Owns the room's WebSocket: presence, shared task lists, and the transport the
 * WebRTC handshake rides on.
 *
 * The reconnect logic is not defensive padding — a Render free instance drops
 * every socket it holds on each deploy and whenever it wakes from idle, so
 * reconnecting is part of normal operation. Peer-to-peer video keeps flowing
 * while the socket is down; only new joins are blocked.
 */
export function useCoworkRoom(slug: string | undefined, token: string | null): CoworkRoomConnection {
  const [connectionState, setConnectionState] = useState<CoworkConnectionState>("connecting");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [selfPeerId, setSelfPeerId] = useState<string | null>(null);
  const [room, setRoom] = useState<CoworkRoomInfo | null>(null);
  const [peers, setPeers] = useState<CoworkPeer[]>([]);
  const [maxParticipants, setMaxParticipants] = useState(5);

  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(new Set<MessageHandler>());
  // The server forgets our task list when the socket dies, so keep the last one
  // to replay after a reconnect.
  const sharedTasksRef = useRef<SharedTask[]>([]);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  // Distinguishes "we are tearing this down on purpose" from "the network died".
  const intentionalCloseRef = useRef(false);
  // Set when the server already told us *why* it is about to close, so the
  // close frame that follows does not replace it with generic wording.
  const explainedCloseRef = useRef(false);

  const send = useCallback((message: OutgoingMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  const shareTasks = useCallback(
    (tasks: SharedTask[]) => {
      sharedTasksRef.current = tasks;
      send({ type: "task-list", payload: { tasks } });
    },
    [send],
  );

  const announceMedia = useCallback(
    (sessionId: string, trackNames: string[]) => {
      send({ type: "media-published", payload: { session_id: sessionId, track_names: trackNames } });
    },
    [send],
  );

  const subscribe = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!slug || !token) {
      return;
    }

    intentionalCloseRef.current = false;
    let disposed = false;

    const clearTimers = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      // A leftover `true` from a previous room's ended frame would make this
      // connection's first ordinary drop look already-explained: no banner and
      // no reconnect. Every fresh connection starts unexplained.
      explainedCloseRef.current = false;

      const socket = new WebSocket(getWebSocketUrl(`/ws/cowork/${slug}`, { token }));
      socketRef.current = socket;

      socket.onopen = () => {
        // Idle sockets get culled by proxies and by the server's own idle timeout.
        heartbeatTimerRef.current = window.setInterval(
          () => send({ type: "ping" }),
          HEARTBEAT_INTERVAL_MS,
        );
      };

      socket.onmessage = event => {
        let message: IncomingMessage;
        try {
          message = JSON.parse(event.data as string) as IncomingMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case "welcome": {
            // A reconnect earns a brand new peer id, so downstream consumers
            // (the WebRTC mesh) must treat this as a fresh identity.
            reconnectAttemptRef.current = 0;
            setConnectionState("connected");
            setFatalError(null);
            setSelfPeerId(message.payload.peer_id);
            setRoom(message.payload.room);
            setMaxParticipants(message.payload.max_participants);
            setPeers(message.payload.peers);
            if (sharedTasksRef.current.length) {
              send({ type: "task-list", payload: { tasks: sharedTasksRef.current } });
            }
            break;
          }
          case "peer-joined":
            setPeers(current =>
              current.some(peer => peer.peer_id === message.payload.peer_id)
                ? current
                : [...current, message.payload],
            );
            break;
          case "peer-left":
            setPeers(current => current.filter(peer => peer.peer_id !== message.payload.peer_id));
            break;
          case "room-ended":
            // The close frame follows immediately; record why now so the user
            // sees "the host ended this room" rather than the generic code text.
            explainedCloseRef.current = true;
            setFatalError(describeRoomEnded(message.payload.reason));
            setConnectionState("closed");
            setPeers([]);
            break;
          case "task-list":
            setPeers(current =>
              current.map(peer =>
                peer.peer_id === message.from ? { ...peer, shared_tasks: message.payload.tasks } : peer,
              ),
            );
            break;
          case "media-published":
            setPeers(current =>
              current.map(peer =>
                peer.peer_id === message.from
                  ? {
                      ...peer,
                      sfu_session_id: message.payload.session_id,
                      published_tracks: message.payload.track_names,
                    }
                  : peer,
              ),
            );
            break;
          default:
            break;
        }

        handlersRef.current.forEach(handler => handler(message));
      };

      socket.onclose = event => {
        clearTimers();
        socketRef.current = null;
        if (disposed || intentionalCloseRef.current) {
          return;
        }

        // A room that is full, ended, or refusing our token will refuse us again
        // just as fast — stop and tell the user instead of looping.
        if (explainedCloseRef.current || isFatalCloseCode(event.code)) {
          if (!explainedCloseRef.current) {
            setFatalError(describeCloseCode(event.code));
          }
          setConnectionState("closed");
          return;
        }

        setConnectionState("reconnecting");
        const delay = reconnectDelayMs(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      intentionalCloseRef.current = true;
      clearTimers();
      socketRef.current?.close(1000, "leaving room");
      socketRef.current = null;
      setPeers([]);
      setSelfPeerId(null);
      setConnectionState("connecting");
    };
  }, [send, slug, token]);

  // Memoised for the same reason as useSfuRoom's return: consumers depend on it.
  return useMemo(
    () => ({
      connectionState,
      fatalError,
      selfPeerId,
      room,
      peers,
      maxParticipants,
      shareTasks,
      announceMedia,
      subscribe,
    }),
    [
      connectionState,
      fatalError,
      selfPeerId,
      room,
      peers,
      maxParticipants,
      shareTasks,
      announceMedia,
      subscribe,
    ],
  );
}
