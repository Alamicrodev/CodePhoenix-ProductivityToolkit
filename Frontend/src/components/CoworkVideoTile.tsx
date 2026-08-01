import { useCallback, useEffect, useRef, useState } from "react";
import { MicOff, Volume2, VideoOff } from "lucide-react";

import { initialsOf } from "../lib/coworkFormat";

interface CoworkVideoTileProps {
  displayName: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  /**
   * Whether this peer publishes any media at all. A peer with no camera has no
   * connection to wait for — showing "Connecting..." for them would read as a
   * permanently stuck room, when the honest state is "nothing to show".
   */
  isPublishing?: boolean;
  isCameraOff?: boolean;
  isMuted?: boolean;
  isHost?: boolean;
  /** Dims the tile while the room socket is down and the roster may be stale. */
  isStale?: boolean;
  /** Set on our own tile when the browser refused camera access. */
  isBlocked?: boolean;
  onRetryMedia?: () => void;
  connectionState?: RTCPeerConnectionState;
}

// "connecting" is normal for a second or two; "failed" usually means this pair
// needs a TURN relay, so say something the user can act on.
function connectionLabel(state: RTCPeerConnectionState | undefined) {
  switch (state) {
    case "connected":
      return null;
    case "failed":
      return "Couldn't connect on this network";
    case "disconnected":
      return "Reconnecting...";
    case "closed":
      return "Disconnected";
    default:
      return "Connecting...";
  }
}

export function CoworkVideoTile({
  displayName,
  stream,
  isLocal = false,
  isPublishing = true,
  isCameraOff = false,
  isMuted = false,
  isHost = false,
  isStale = false,
  isBlocked = false,
  onRetryMedia,
  connectionState,
}: CoworkVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Autoplay with sound is blocked until the user has interacted with the site
  // — true for every guest landing straight on a share link. When that happens
  // the fallback is muted playback (always allowed) plus a tap-to-unmute chip;
  // without it the tile stays black even though media is flowing.
  const [needsUnmute, setNeedsUnmute] = useState(false);

  // srcObject is not an attribute, so it has to be assigned imperatively.
  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    if (element.srcObject !== stream) {
      element.srcObject = stream;
      setNeedsUnmute(false);
    }
    if (!stream) {
      return;
    }
    element.play().catch((error: DOMException) => {
      if (error.name === "NotAllowedError") {
        setNeedsUnmute(true);
      }
    });
  }, [stream]);

  // The muted prop only lands on the render after needsUnmute flips, so the
  // (now allowed) play() retry has to wait for it here.
  useEffect(() => {
    if (needsUnmute) {
      videoRef.current?.play().catch(() => undefined);
    }
  }, [needsUnmute]);

  const unmute = useCallback(() => {
    // Runs inside a click, which is the user gesture autoplay was waiting for.
    setNeedsUnmute(false);
    const element = videoRef.current;
    if (element) {
      element.muted = false;
      element.play().catch(() => undefined);
    }
  }, []);

  const status = isLocal || !isPublishing ? null : connectionLabel(connectionState);
  const showPlaceholder = (isCameraOff || !stream) && !isBlocked;

  return (
    <div
      // The video surface keeps the same near-black in both themes: a tile that
      // followed the theme would flash white around a dark camera feed.
      style={{ backgroundColor: "#101012" }}
      className={`relative aspect-video overflow-hidden rounded-[10px] transition-opacity ${
        isStale ? "opacity-55" : ""
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Never play our own audio back — it would echo.
        muted={isLocal || needsUnmute}
        // Mirroring makes a local preview feel like a mirror rather than a stranger.
        className={`h-full w-full object-cover ${isLocal ? "-scale-x-100" : ""} ${
          showPlaceholder || isBlocked ? "invisible" : ""
        }`}
      />

      {showPlaceholder && (
        <div
          style={{ backgroundColor: "#161618" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold text-white"
          >
            {initialsOf(displayName)}
          </div>
        </div>
      )}

      {isBlocked && (
        <div
          style={{ backgroundColor: "#161618" }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
        >
          <VideoOff className="h-5 w-5 text-white/70" />
          <p className="text-[11.5px] text-white/70">Camera blocked — allow access in the browser</p>
          {onRetryMedia && (
            <button
              type="button"
              onClick={onRetryMedia}
              className="rounded-md border border-white/30 px-2 py-1 text-[11px] text-white/90 transition-colors hover:bg-white/10"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Name pill */}
      <div
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        className="absolute bottom-2 left-2 flex max-w-[calc(100%-16px)] items-center gap-1.5 rounded px-1.5 py-0.5"
      >
        <span className="truncate text-[10.5px] text-white/[0.92]">
          {displayName}
          {isLocal ? " (you)" : ""}
        </span>
        {isHost && (
          <span className="shrink-0 rounded-[3px] border border-white/30 px-1 text-[8.5px] font-semibold uppercase leading-[14px] text-white/[0.92]">
            Host
          </span>
        )}
      </div>

      {isMuted && (
        <div
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          className="absolute bottom-2 right-2 flex h-[22px] w-[22px] items-center justify-center rounded-full"
          title="Microphone off"
        >
          <MicOff className="h-3 w-3 text-white/[0.92]" />
          <span className="sr-only">Microphone off</span>
        </div>
      )}

      {status && (
        <div
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10.5px] text-white/[0.92]"
        >
          {status}
        </div>
      )}

      {needsUnmute && !isLocal && (
        <button
          type="button"
          onClick={unmute}
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          className="absolute right-2 top-2 flex items-center gap-1 rounded px-2 py-1 text-[10.5px] text-white/[0.92] hover:bg-black/80"
        >
          <Volume2 className="h-3 w-3" />
          Tap for sound
        </button>
      )}
    </div>
  );
}

export default CoworkVideoTile;
