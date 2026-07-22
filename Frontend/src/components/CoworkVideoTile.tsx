import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";

import { SharedTask } from "../lib/coworkProtocol";

interface CoworkVideoTileProps {
  displayName: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isCameraOff?: boolean;
  isMuted?: boolean;
  connectionState?: RTCPeerConnectionState;
  sharedTasks?: SharedTask[];
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
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
  isCameraOff = false,
  isMuted = false,
  connectionState,
  sharedTasks = [],
}: CoworkVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // srcObject is not an attribute, so it has to be assigned imperatively.
  useEffect(() => {
    const element = videoRef.current;
    if (element && element.srcObject !== stream) {
      element.srcObject = stream;
    }
  }, [stream]);

  const status = isLocal ? null : connectionLabel(connectionState);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Never play our own audio back — it would echo.
        muted={isLocal}
        // Mirroring makes a local preview feel like a mirror rather than a stranger.
        className={`h-full w-full object-cover ${isLocal ? "-scale-x-100" : ""} ${
          isCameraOff || !stream ? "invisible" : ""
        }`}
      />

      {(isCameraOff || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
            {initialsOf(displayName) || "?"}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className="truncate text-sm font-medium text-white">
          {displayName}
          {isLocal ? " (you)" : ""}
        </span>
        {isMuted && <MicOff className="h-4 w-4 shrink-0 text-white/80" />}
        {isCameraOff && <VideoOff className="h-4 w-4 shrink-0 text-white/80" />}
        {sharedTasks.length > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
            {sharedTasks.filter(task => task.completed).length}/{sharedTasks.length} done
          </span>
        )}
      </div>

      {status && (
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
          {status}
        </div>
      )}
    </div>
  );
}

export default CoworkVideoTile;
