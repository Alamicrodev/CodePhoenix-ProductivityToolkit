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

/**
 * Builds a peer-to-peer mesh: one RTCPeerConnection per other participant, with
 * the signaling handshake relayed through the room socket. Media never reaches
 * our backend, which is the whole reason this runs on a free instance.
 *
 * Glare (both sides offering at once) is avoided by deciding the offerer
 * deterministically — the peer with the smaller id dials — rather than by
 * implementing rollback. Both ends compute the same answer from the same two
 * ids, so exactly one offer is ever created per pair.
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

  const connectionsRef = useRef(new Map<string, RTCPeerConnection>());
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

    navigator.mediaDevices
      .getUserMedia({ video: VIDEO_CONSTRAINTS, audio: true })
      .then(acquired => {
        if (cancelled) {
          acquired.getTracks().forEach(track => track.stop());
          return;
        }
        stream = acquired;
        localStreamRef.current = acquired;
        setLocalStream(acquired);
        setMediaError(null);
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
    // Park the mesh until the new attempt resolves, otherwise connections would
    // be rebuilt receive-only mid-retry and then rebuilt again on success.
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
    const connectionToClose = connectionsRef.current.get(peerId);
    if (connectionToClose) {
      connectionToClose.onicecandidate = null;
      connectionToClose.ontrack = null;
      connectionToClose.onconnectionstatechange = null;
      connectionToClose.close();
      connectionsRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    setRemoteMedia(current => {
      const { [peerId]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const createConnection = useCallback(
    (peerId: string) => {
      const peerConnection = new RTCPeerConnection({ iceServers: iceServersRef.current });
      connectionsRef.current.set(peerId, peerConnection);
      updateRemote(peerId, { connectionState: "new" });

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        void capVideoBitrate(peerConnection);
      } else {
        // No camera: still declare receive-only transceivers. Without them the
        // offer carries no media lines at all and nothing would flow in either
        // direction, leaving this person staring at an empty room.
        peerConnection.addTransceiver("video", { direction: "recvonly" });
        peerConnection.addTransceiver("audio", { direction: "recvonly" });
      }

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          sendSignalRef.current("ice-candidate", peerId, event.candidate.toJSON() as Record<string, unknown>);
        }
      };

      peerConnection.ontrack = event => {
        updateRemote(peerId, { stream: event.streams[0] ?? null });
      };

      peerConnection.onconnectionstatechange = () => {
        updateRemote(peerId, { connectionState: peerConnection.connectionState });
        // A failed pair usually means the network path changed (or there is no
        // TURN and this pair needs one). An ICE restart is cheap; try once.
        if (peerConnection.connectionState === "failed") {
          peerConnection.restartIce();
        }
      };

      return peerConnection;
    },
    [updateRemote],
  );

  const dial = useCallback(async (peerId: string, peerConnection: RTCPeerConnection) => {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendSignalRef.current("offer", peerId, { sdp: offer.sdp, type: offer.type });
    } catch {
      // The pair will retry when either side reconnects.
    }
  }, []);

  // Open a connection to everyone in the roster, drop the ones who left.
  useEffect(() => {
    // Waits for media to settle, but not for media to exist.
    if (!selfPeerId || !isMediaSettled) {
      return;
    }

    // If the local stream itself changed (first acquisition, or a successful
    // retry after a denial), every existing connection was negotiated against
    // the old set of tracks and has to be rebuilt.
    const currentStreamId = localStream?.id ?? null;
    if (streamIdRef.current !== currentStreamId) {
      streamIdRef.current = currentStreamId;
      connectionsRef.current.forEach((_connection, peerId) => closeConnection(peerId));
    }

    const currentIds = new Set(peers.map(peer => peer.peer_id).filter(id => id !== selfPeerId));

    connectionsRef.current.forEach((_connection, peerId) => {
      if (!currentIds.has(peerId)) {
        closeConnection(peerId);
      }
    });

    currentIds.forEach(peerId => {
      if (connectionsRef.current.has(peerId)) {
        return;
      }
      const peerConnection = createConnection(peerId);
      // Deterministic offerer: both ends compare the same pair of ids, so exactly
      // one of them dials and there is no glare to resolve.
      if (selfPeerId < peerId) {
        void dial(peerId, peerConnection);
      }
    });
  }, [closeConnection, createConnection, dial, isMediaSettled, localStream, peerIds, peers, selfPeerId]);

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
      let peerConnection = connectionsRef.current.get(peerId);

      if (message.type === "offer") {
        // The offer may arrive before the roster update that would have created
        // this connection, so build it on demand.
        if (!peerConnection) {
          peerConnection = createConnection(peerId);
        }
        await peerConnection.setRemoteDescription(message.payload as unknown as RTCSessionDescriptionInit);
        await drainCandidates(peerConnection, pendingCandidatesRef.current, peerId);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendSignalRef.current("answer", peerId, { sdp: answer.sdp, type: answer.type });
        return;
      }

      if (!peerConnection) {
        return;
      }

      if (message.type === "answer") {
        await peerConnection.setRemoteDescription(message.payload as unknown as RTCSessionDescriptionInit);
        await drainCandidates(peerConnection, pendingCandidatesRef.current, peerId);
        return;
      }

      const candidate = message.payload as unknown as RTCIceCandidateInit;
      if (!peerConnection.remoteDescription) {
        const queued = pendingCandidatesRef.current.get(peerId) ?? [];
        queued.push(candidate);
        pendingCandidatesRef.current.set(peerId, queued);
        return;
      }
      await peerConnection.addIceCandidate(candidate).catch(() => undefined);
    };

    return subscribe(message => {
      void handle(message);
    });
  }, [createConnection, selfPeerId, subscribe]);

  // Tear the whole mesh down when the page unmounts.
  useEffect(() => {
    const connections = connectionsRef.current;
    return () => {
      connections.forEach(peerConnection => peerConnection.close());
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
