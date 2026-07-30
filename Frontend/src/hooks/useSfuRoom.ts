import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CoworkRoomConnection } from "./useCoworkRoom";
import { coworkSfuApi, LocalTrackDescriptor, SfuTracksResponse } from "../lib/coworkSfuApi";
import { ApiError } from "../lib/api";

// One stream up regardless of room size now, but every subscriber still
// downloads it — the bitrate cap protects the room's total download budget.
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

export interface SfuRoom {
  localStream: MediaStream | null;
  remoteMedia: Record<string, RemotePeerMedia>;
  isMicOn: boolean;
  isCameraOn: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  mediaError: string | null;
  retryMedia: () => void;
  /** Set when the video service itself is down/unconfigured. Room still works. */
  videoError: string | null;
}

interface SfuRoomOptions {
  slug: string | undefined;
  token: string | null;
  connection: CoworkRoomConnection;
  iceServers: RTCIceServer[];
  enabled: boolean;
}

/**
 * The SFU replacement for the old P2P mesh: ONE PeerConnection to Cloudflare's
 * edge instead of one per peer. Publishing and subscribing are renegotiations
 * of that single connection, orchestrated through the backend proxy.
 *
 * The load-bearing piece is the negotiation queue. Publish and subscribe both
 * rewrite the PeerConnection's signaling state; two running concurrently (e.g.
 * two peers announcing media in the same second) corrupt it. Every operation
 * goes through runExclusive() — nothing else touches the PC.
 */
export function useSfuRoom({ slug, token, connection, iceServers, enabled }: SfuRoomOptions): SfuRoom {
  const { peers, selfPeerId, announceMedia } = connection;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<Record<string, RemotePeerMedia>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [isMediaSettled, setIsMediaSettled] = useState(false);
  // The ready session id, as STATE rather than only a ref: subscriptions must
  // re-evaluate when the session finishes building. A joiner with a real
  // camera receives the welcome roster BEFORE getUserMedia resolves, so its
  // first subscription pass runs against a session that does not exist yet —
  // without this re-trigger it would never see peers who published before it
  // arrived (the "joiner can't see the host" bug).
  const [readySessionId, setReadySessionId] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Serializes every negotiation on the single PC. See the hook docstring.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // mid -> peer_id, filled from subscribe responses so ontrack can route
  // arriving tracks to the right tile.
  const midToPeerRef = useRef(new Map<string, string>());
  // peer_id -> the track names we already subscribed to (skip duplicates).
  const subscribedRef = useRef(new Map<string, string>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const announceMediaRef = useRef(announceMedia);

  useEffect(() => {
    announceMediaRef.current = announceMedia;
  }, [announceMedia]);

  const runExclusive = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  // --- local camera/mic (same settle-not-exist contract as the mesh had) ----

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
    setIsMediaSettled(false);
    setMediaAttempt(attempt => attempt + 1);
  }, []);

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

  // --- session lifecycle ----------------------------------------------------

  // Keyed on selfPeerId: a socket reconnect issues a new peer identity, and the
  // 30s track GC means old sessions cannot be resurrected — always rebuild.
  useEffect(() => {
    if (!enabled || !slug || !token || !selfPeerId || !isMediaSettled) {
      return;
    }

    let disposed = false;

    const setup = () =>
      runExclusive(async () => {
        if (disposed) {
          return;
        }

        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        pc.ontrack = event => {
          const peerId = midToPeerRef.current.get(event.transceiver.mid ?? "");
          if (!peerId) {
            return;
          }
          setRemoteMedia(current => {
            const existing = current[peerId];
            // Group this peer's audio+video into one MediaStream for the tile.
            const streamForPeer = existing?.stream ?? new MediaStream();
            streamForPeer.addTrack(event.track);
            return {
              ...current,
              [peerId]: { stream: streamForPeer, connectionState: pc.connectionState },
            };
          });
        };

        pc.onconnectionstatechange = () => {
          // One PC now serves every tile: reflect its state everywhere.
          setRemoteMedia(current =>
            Object.fromEntries(
              Object.entries(current).map(([peerId, media]) => [
                peerId,
                { ...media, connectionState: pc.connectionState },
              ]),
            ),
          );
          if (pc.connectionState === "failed") {
            pc.restartIce();
          }
        };

        const stream = localStreamRef.current;

        if (!stream) {
          // Receive-only: nothing to publish means nothing would ever negotiate
          // the PeerConnection, and Cloudflare refuses operations on a session
          // that never connected. Bootstrap with a data-channel offer so ICE
          // establishes before the first subscribe.
          pc.createDataChannel("bootstrap");
          const bootstrapOffer = await pc.createOffer();
          await pc.setLocalDescription(bootstrapOffer);
          const created = await coworkSfuApi.createSession(token, slug, {
            type: "offer",
            sdp: bootstrapOffer.sdp ?? "",
          });
          sessionIdRef.current = created.session_id;
          if (created.session_description) {
            await pc.setRemoteDescription(created.session_description);
          }
          setReadySessionId(created.session_id);
          setVideoError(null);
          return;
        }

        // Publisher path: the session starts bare and the publish offer is the
        // negotiation that connects it (proven live by the fake publisher).
        const { session_id } = await coworkSfuApi.createSession(token, slug);
        sessionIdRef.current = session_id;

        // sendonly: we publish; what we watch arrives via subscribe transceivers.
        const descriptors: LocalTrackDescriptor[] = [];
        for (const track of stream.getTracks()) {
          pc.addTransceiver(track, { direction: "sendonly" });
          // mids are only assigned once an offer exists, so collect after.
          descriptors.push({ location: "local", mid: "", trackName: `${selfPeerId}-${track.kind}` });
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Now the mids exist; match them to tracks in transceiver order.
        pc.getTransceivers().forEach((transceiver, index) => {
          if (descriptors[index]) {
            descriptors[index].mid = transceiver.mid ?? String(index);
          }
        });

        const response = await coworkSfuApi.publish(
          token,
          slug,
          session_id,
          { type: "offer", sdp: offer.sdp ?? "" },
          descriptors,
        );
        if (response.sessionDescription) {
          await pc.setRemoteDescription(response.sessionDescription);
        }
        await capVideoBitrate(pc);

        announceMediaRef.current(
          session_id,
          descriptors.map(descriptor => descriptor.trackName),
        );

        setReadySessionId(session_id);
        setVideoError(null);
      }).catch((error: unknown) => {
        if (!disposed) {
          setVideoError(describeVideoError(error));
        }
      });

    void setup();

    return () => {
      disposed = true;
      pcRef.current?.close();
      pcRef.current = null;
      sessionIdRef.current = null;
      midToPeerRef.current.clear();
      subscribedRef.current.clear();
      setReadySessionId(null);
      setRemoteMedia({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- iceServers is
    // intentionally read once per session build; changing STUN URLs mid-call
    // must not tear down a healthy connection.
  }, [enabled, isMediaSettled, runExclusive, selfPeerId, slug, token]);

  // --- subscriptions --------------------------------------------------------

  const mediaRoster = useMemo(
    () =>
      peers
        .filter(
          peer =>
            peer.peer_id !== selfPeerId && peer.sfu_session_id && peer.published_tracks.length > 0,
        )
        .map(peer => ({
          peerId: peer.peer_id,
          sessionId: peer.sfu_session_id as string,
          trackNames: [...peer.published_tracks].sort(),
        })),
    [peers, selfPeerId],
  );

  useEffect(() => {
    // Waiting for readySessionId is what makes welcome-roster subscriptions
    // work: this effect re-runs when the session finishes building and only
    // then commits to subscribing.
    if (!slug || !token || !selfPeerId || !readySessionId) {
      return;
    }

    const currentPeerIds = new Set(mediaRoster.map(entry => entry.peerId));

    // Drop tiles (and subscription bookkeeping) for peers who left. Their
    // transceivers keep existing on the PC — recycling them is not worth the
    // renegotiation complexity at this room size; the session rebuild on
    // reconnect cleans up for real.
    subscribedRef.current.forEach((_key, peerId) => {
      if (!currentPeerIds.has(peerId)) {
        subscribedRef.current.delete(peerId);
        setRemoteMedia(current => {
          const { [peerId]: _removed, ...rest } = current;
          return rest;
        });
      }
    });

    mediaRoster.forEach(entry => {
      const subscriptionKey = `${entry.sessionId}:${entry.trackNames.join(",")}`;
      if (subscribedRef.current.get(entry.peerId) === subscriptionKey) {
        return;
      }
      subscribedRef.current.set(entry.peerId, subscriptionKey);

      void runExclusive(async () => {
        const pc = pcRef.current;
        const sessionId = sessionIdRef.current;
        if (!pc || !sessionId) {
          // Session tore down between enqueue and run. Un-mark the peer so the
          // next roster/session change retries — leaving the key would mean
          // never subscribing to this peer at all.
          subscribedRef.current.delete(entry.peerId);
          return;
        }

        const response: SfuTracksResponse = await coworkSfuApi.subscribe(
          token,
          slug,
          sessionId,
          entry.sessionId,
          entry.trackNames,
        );

        // Cloudflare tells us which mid each requested track landed on; route
        // ontrack events for those mids to this peer's tile.
        (response.tracks ?? []).forEach(track => {
          if (track.mid) {
            midToPeerRef.current.set(track.mid, entry.peerId);
          }
        });

        // Subscribing makes Cloudflare the offerer; we answer and confirm.
        if (response.requiresImmediateRenegotiation && response.sessionDescription) {
          await pc.setRemoteDescription(response.sessionDescription);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await coworkSfuApi.renegotiate(token, slug, sessionId, {
            type: "answer",
            sdp: answer.sdp ?? "",
          });
        }
      }).catch((error: unknown) => {
        // Allow a retry on the next roster change instead of poisoning the key.
        subscribedRef.current.delete(entry.peerId);
        setVideoError(describeVideoError(error));
      });
    });
  }, [mediaRoster, readySessionId, runExclusive, selfPeerId, slug, token]);

  return {
    localStream,
    remoteMedia,
    isMicOn,
    isCameraOn,
    toggleMic,
    toggleCamera,
    mediaError,
    retryMedia,
    videoError,
  };
}

//keep the one outgoing video stream small: every subscriber downloads it
async function capVideoBitrate(pc: RTCPeerConnection) {
  const sender = pc.getSenders().find(entry => entry.track?.kind === "video");
  if (!sender) {
    return;
  }
  try {
    const parameters = sender.getParameters();
    parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
    parameters.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
    await sender.setParameters(parameters);
  } catch {
    // Some browsers reject setParameters before the connection settles; the
    // stream still works, just uncapped.
  }
}

function describeVideoError(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) {
    return "Video is unavailable right now — the room still works for presence and tasks.";
  }
  return "Video couldn't start. Presence and tasks still work; try rejoining the room.";
}
