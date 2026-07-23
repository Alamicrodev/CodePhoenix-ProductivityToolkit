import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CoworkRoomConnection } from "./useCoworkRoom";
import { IncomingMessage } from "../lib/coworkProtocol";

// A full mesh makes every participant upload one copy of their camera per other
// participant, so the sending side is what has to stay small.
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 360 },
  frameRate: { ideal: 15, max: 24 },
};
const MAX_VIDEO_BITRATE = 300_000;
const MEDIA_KINDS = ["video", "audio"] as const;

export interface RemotePeerMedia {
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
}

export interface WebRTCMesh {
  localStream: MediaStream | null;
  remoteMedia: Record<string, RemotePeerMedia>;
  isMicOn: boolean;
  isCameraOn: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  mediaError: string | null;
  retryMedia: () => void;
}

interface MeshOptions {
  connection: CoworkRoomConnection;
  iceServers: RTCIceServer[];
  enabled: boolean;
}

// Per-pair negotiation state for the "perfect negotiation" pattern.
interface PeerState {
  pc: RTCPeerConnection;
  /**
   * The self peer id this connection was built as. A reconnect issues a fresh
   * id and negotiation roles derive from the id pair, so a connection whose
   * selfId is stale must be torn down and re-dialed.
   */
  selfId: string;
  /** The polite side yields on glare: it drops its own offer and answers. */
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
}

/**
 * Builds a peer-to-peer mesh: one RTCPeerConnection per other participant, with
 * the signaling handshake relayed through the room socket. Media never reaches
 * our backend, which is the whole reason this runs on a free instance.
 *
 * Negotiation follows the W3C "perfect negotiation" pattern: either side may
 * (re)negotiate whenever it needs to — the initial handshake, an ICE restart
 * after a network change, a camera granted mid-call — and when offers cross,
 * the polite side (the larger peer id) abandons its own offer and answers while
 * the impolite side ignores the incoming one. Media changes swap tracks on the
 * live connection instead of rebuilding it: a teardown is invisible to the
 * remote side, so only one end would ever re-dial and the pair would strand.
 */
export function useWebRTCMesh({ connection, iceServers, enabled }: MeshOptions): WebRTCMesh {
  const { peers, selfPeerId, sendSignal, subscribe } = connection;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<Record<string, RemotePeerMedia>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  // Whether getUserMedia has finished, succeeded or not. Connections wait for
  // this so they are built with the right tracks, but they are NOT gated on
  // actually having a camera — someone who declined permission or has no webcam
  // still gets to watch and hear everyone else.
  const [isMediaSettled, setIsMediaSettled] = useState(false);

  const connectionsRef = useRef(new Map<string, PeerState>());
  // Candidates can arrive before the answer's remote description is set; holding
  // them avoids the "remote description not set" error and a dropped candidate.
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const localStreamRef = useRef<MediaStream | null>(null);
  // Sentinel so the first run never counts as a stream change.
  const streamIdRef = useRef<string | null | undefined>(undefined);
  const sendSignalRef = useRef(sendSignal);
  const iceServersRef = useRef(iceServers);

  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  useEffect(() => {
    iceServersRef.current = iceServers;
  }, [iceServers]);

  const peerIds = useMemo(() => peers.map(peer => peer.peer_id).sort().join(","), [peers]);

  // --- local camera/mic -----------------------------------------------------

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;

    acquireLocalMedia()
      .then(acquired => {
        if (cancelled) {
          acquired.getTracks().forEach(track => track.stop());
          return;
        }
        stream = acquired;
        localStreamRef.current = acquired;
        setLocalStream(acquired);
        // Success can still mean a partial device set (camera but no mic, or
        // the reverse) — send what exists and say what is missing.
        setMediaError(describeMissingDevices(acquired));
        setIsMicOn(acquired.getAudioTracks().length > 0);
        setIsCameraOn(acquired.getVideoTracks().length > 0);
        setIsMediaSettled(true);
      })
      .catch((error: DOMException) => {
        if (cancelled) {
          return;
        }
        setMediaError(
          error.name === "NotAllowedError"
            ? "Camera and microphone access was blocked, so nobody can see or hear you. You can still see and hear everyone else."
            : "No camera or microphone was found. You can still see and hear everyone else.",
        );
        // Settled, just without media: proceed and join receive-only.
        setIsMediaSettled(true);
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    };
  }, [enabled, mediaAttempt]);

  const retryMedia = useCallback(() => {
    setMediaError(null);
    // Park the roster effect until the new attempt resolves so connections are
    // not resynced against a half-changed stream mid-retry.
    setIsMediaSettled(false);
    setMediaAttempt(attempt => attempt + 1);
  }, []);

  // Toggling a track's `enabled` flag needs no renegotiation, unlike removing it.
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    const next = !stream.getAudioTracks().every(track => track.enabled);
    stream.getAudioTracks().forEach(track => (track.enabled = next));
    setIsMicOn(next);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    const next = !stream.getVideoTracks().every(track => track.enabled);
    stream.getVideoTracks().forEach(track => (track.enabled = next));
    setIsCameraOn(next);
  }, []);

  // --- peer connections -----------------------------------------------------

  const updateRemote = useCallback((peerId: string, patch: Partial<RemotePeerMedia>) => {
    setRemoteMedia(current => ({
      ...current,
      [peerId]: { stream: null, connectionState: "new", ...current[peerId], ...patch },
    }));
  }, []);

  const closeConnection = useCallback((peerId: string) => {
    const state = connectionsRef.current.get(peerId);
    if (state) {
      state.pc.onnegotiationneeded = null;
      state.pc.onicecandidate = null;
      state.pc.ontrack = null;
      state.pc.onconnectionstatechange = null;
      state.pc.close();
      connectionsRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    setRemoteMedia(current => {
      const { [peerId]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const createConnection = useCallback(
    (peerId: string, selfId: string) => {
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const state: PeerState = {
        pc,
        selfId,
        // Roles must come out opposite at the two ends, and both ends compute
        // them from the same pair of ids.
        polite: selfId > peerId,
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswer: false,
      };
      connectionsRef.current.set(peerId, state);
      updateRemote(peerId, { connectionState: "new" });

      const stream = localStreamRef.current;
      for (const kind of MEDIA_KINDS) {
        const track = stream?.getTracks().find(entry => entry.kind === kind);
        if (track && stream) {
          pc.addTransceiver(track, { direction: "sendrecv", streams: [stream] });
        } else {
          // No device of this kind (yet): a receive-only transceiver keeps the
          // m-line in the SDP so media flows inbound now and can turn outbound
          // later (replaceTrack + direction) without rebuilding the connection.
          pc.addTransceiver(kind, { direction: "recvonly" });
        }
      }
      if (stream) {
        void capVideoBitrate(pc);
      }

      // The transceivers added above queue a negotiationneeded event — this is
      // what sends the initial offer, and every later one (ICE restart, a
      // direction change). Both ends fire it; glare resolves via politeness.
      pc.onnegotiationneeded = async () => {
        try {
          state.makingOffer = true;
          await pc.setLocalDescription();
          const description = pc.localDescription;
          if (description) {
            sendSignalRef.current("offer", peerId, { sdp: description.sdp, type: description.type });
          }
        } catch {
          // A failed offer is superseded by the next negotiationneeded event.
        } finally {
          state.makingOffer = false;
        }
      };

      pc.onicecandidate = event => {
        if (event.candidate) {
          sendSignalRef.current("ice-candidate", peerId, event.candidate.toJSON() as Record<string, unknown>);
        }
      };

      pc.ontrack = event => {
        const eventStream = event.streams[0] ?? null;
        setRemoteMedia(current => {
          const existing = current[peerId] ?? { stream: null, connectionState: "new" as RTCPeerConnectionState };
          let stream = eventStream ?? existing.stream;
          if (!eventStream) {
            // A track renegotiated onto a live pair (a camera granted after the
            // handshake) may carry no stream association; collect such tracks
            // into the stream already rendered for this peer.
            stream = stream ?? new MediaStream();
            if (!stream.getTracks().includes(event.track)) {
              stream.addTrack(event.track);
            }
          }
          return { ...current, [peerId]: { ...existing, stream } };
        });
      };

      pc.onconnectionstatechange = () => {
        updateRemote(peerId, { connectionState: pc.connectionState });
        // A failed pair usually means the network path changed (or there is no
        // TURN and this pair needs one). restartIce() queues negotiationneeded,
        // so the handler above ships a fresh offer with new ICE credentials.
        if (pc.connectionState === "failed") {
          pc.restartIce();
        }
      };

      return state;
    },
    [updateRemote],
  );

  // Push the current local stream into a live connection. replaceTrack swaps
  // media without renegotiating; the direction change is what queues
  // negotiationneeded and renegotiates the pair in place.
  const applyLocalStream = useCallback((state: PeerState) => {
    const stream = localStreamRef.current;
    for (const kind of MEDIA_KINDS) {
      const track = stream?.getTracks().find(entry => entry.kind === kind) ?? null;
      const transceiver = state.pc.getTransceivers().find(entry => entry.receiver.track.kind === kind);
      if (!transceiver) {
        continue;
      }
      const sender = transceiver.sender as RTCRtpSender & {
        setStreams?: (...streams: MediaStream[]) => void;
      };
      try {
        void sender.replaceTrack(track).catch(() => undefined);
        if (track && stream) {
          // Associates the track with our stream id so the remote's ontrack
          // sees event.streams; browsers without setStreams are covered by the
          // bare-track fallback in ontrack.
          sender.setStreams?.(stream);
        }
        transceiver.direction = track ? "sendrecv" : "recvonly";
      } catch {
        // A transceiver in a closing connection can reject any of these; the
        // roster effect will drop the connection shortly.
      }
    }
    if (stream) {
      void capVideoBitrate(state.pc);
    }
  }, []);

  // Open a connection to everyone in the roster, drop the ones who left.
  useEffect(() => {
    // Waits for media to settle, but not for media to exist.
    if (!selfPeerId || !isMediaSettled) {
      return;
    }

    // Reconnected under a fresh peer id: everyone else saw our old id leave and
    // a "new" peer arrive, so their end of each old-mesh connection is going
    // away and the roles it was built with are stale. The check is per
    // connection, NOT "did selfPeerId change since last run": a connection
    // built on demand for the CURRENT id — by an offer that arrived while
    // getUserMedia was still pending — is already live on the remote side, and
    // closing it here would strand that peer on a dead pair it never learns
    // about.
    connectionsRef.current.forEach((state, peerId) => {
      if (state.selfId !== selfPeerId) {
        closeConnection(peerId);
      }
    });

    // The local stream changed (first acquisition, or a retry after a denial):
    // swap the tracks into every live connection. The pairs renegotiate in
    // place — tearing them down would strand every pair whose remote end never
    // learns it needs to dial again.
    const currentStreamId = localStream?.id ?? null;
    if (streamIdRef.current !== currentStreamId) {
      streamIdRef.current = currentStreamId;
      connectionsRef.current.forEach(state => applyLocalStream(state));
    }

    const currentIds = new Set(peerIds.split(",").filter(id => id && id !== selfPeerId));

    connectionsRef.current.forEach((_state, peerId) => {
      if (!currentIds.has(peerId)) {
        closeConnection(peerId);
      }
    });

    currentIds.forEach(peerId => {
      if (!connectionsRef.current.has(peerId)) {
        createConnection(peerId, selfPeerId);
      }
    });
  }, [applyLocalStream, closeConnection, createConnection, isMediaSettled, localStream, peerIds, selfPeerId]);

  // Handle the signaling messages our peers send back.
  useEffect(() => {
    if (!selfPeerId) {
      return;
    }

    const handle = async (message: IncomingMessage) => {
      if (message.type !== "offer" && message.type !== "answer" && message.type !== "ice-candidate") {
        return;
      }

      const peerId = message.from;
      let state = connectionsRef.current.get(peerId);

      if (message.type === "offer" || message.type === "answer") {
        const description = message.payload as unknown as RTCSessionDescriptionInit;

        if (!state) {
          if (description.type !== "offer") {
            return;
          }
          // The offer may arrive before the roster update that would have
          // created this connection, so build it on demand.
          state = createConnection(peerId, selfPeerId);
        }

        // Glare check: an offer landing while our own offer is in flight. The
        // impolite side ignores it (its own offer will win); the polite side
        // lets setRemoteDescription implicitly roll its half-made offer back.
        const readyForOffer =
          !state.makingOffer && (state.pc.signalingState === "stable" || state.settingRemoteAnswer);
        const offerCollision = description.type === "offer" && !readyForOffer;
        state.ignoreOffer = !state.polite && offerCollision;
        if (state.ignoreOffer) {
          return;
        }

        state.settingRemoteAnswer = description.type === "answer";
        try {
          await state.pc.setRemoteDescription(description);
        } catch (error) {
          if (description.type !== "offer") {
            throw error;
          }
          // An offer that cannot apply to this session means the remote end
          // rebuilt its connection from scratch (their half of this pair is
          // already gone, so no rollback can reconcile the two). Rebuild ours
          // to match and answer on the fresh pair — dropping the offer would
          // strand both sides on a handshake that can never complete.
          closeConnection(peerId);
          state = createConnection(peerId, selfPeerId);
          await state.pc.setRemoteDescription(description);
        } finally {
          state.settingRemoteAnswer = false;
        }
        await drainCandidates(state.pc, pendingCandidatesRef.current, peerId);

        if (description.type === "offer") {
          await state.pc.setLocalDescription();
          const answer = state.pc.localDescription;
          if (answer) {
            sendSignalRef.current("answer", peerId, { sdp: answer.sdp, type: answer.type });
          }
        }
        return;
      }

      if (!state) {
        return;
      }

      const candidate = message.payload as unknown as RTCIceCandidateInit;
      if (!state.pc.remoteDescription) {
        const queued = pendingCandidatesRef.current.get(peerId) ?? [];
        queued.push(candidate);
        pendingCandidatesRef.current.set(peerId, queued);
        return;
      }
      // Candidates belonging to an offer we chose to ignore fail against the
      // wrong remote description — expected during glare, not an error.
      await state.pc.addIceCandidate(candidate).catch(() => undefined);
    };

    return subscribe(message => {
      // Never let one bad signal kill the subscription, but log it: a silently
      // dropped offer or answer looks exactly like "webcam never connects".
      handle(message).catch(error => {
        console.error(`Cowork signaling: failed to handle '${message.type}'`, error);
      });
    });
  }, [createConnection, selfPeerId, subscribe]);

  // Tear the whole mesh down when the page unmounts.
  useEffect(() => {
    const connections = connectionsRef.current;
    return () => {
      connections.forEach(state => state.pc.close());
      connections.clear();
      pendingCandidatesRef.current.clear();
    };
  }, []);

  return {
    localStream,
    remoteMedia,
    isMicOn,
    isCameraOn,
    toggleMic,
    toggleCamera,
    mediaError,
    retryMedia,
  };
}

// Ask for camera+mic, then fall back to whichever single device exists — a user
// with a webcam but no microphone must still be seen, and vice versa. A denied
// permission stays denied no matter how little is asked for, so stop there.
async function acquireLocalMedia(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: VIDEO_CONSTRAINTS, audio: true },
    { video: VIDEO_CONSTRAINTS, audio: false },
    { video: false, audio: true },
  ];
  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      if ((error as DOMException).name === "NotAllowedError") {
        break;
      }
    }
  }
  throw lastError;
}

function describeMissingDevices(stream: MediaStream): string | null {
  if (!stream.getVideoTracks().length) {
    return "No camera was found — others will hear you but not see you.";
  }
  if (!stream.getAudioTracks().length) {
    return "No microphone was found — others will see you but not hear you.";
  }
  return null;
}

//keep each outgoing video stream small enough that N-1 copies still fit upstream
async function capVideoBitrate(peerConnection: RTCPeerConnection) {
  const sender = peerConnection.getSenders().find(entry => entry.track?.kind === "video");
  if (!sender) {
    return;
  }
  try {
    const parameters = sender.getParameters();
    parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
    parameters.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
    await sender.setParameters(parameters);
  } catch {
    // Older browsers reject setParameters before negotiation; the stream still
    // works, just without our cap.
  }
}

//apply candidates that arrived before the remote description was ready
async function drainCandidates(
  peerConnection: RTCPeerConnection,
  pending: Map<string, RTCIceCandidateInit[]>,
  peerId: string,
) {
  const queued = pending.get(peerId);
  if (!queued?.length) {
    return;
  }
  pending.delete(peerId);
  for (const candidate of queued) {
    await peerConnection.addIceCandidate(candidate).catch(() => undefined);
  }
}
