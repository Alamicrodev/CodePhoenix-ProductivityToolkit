import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  ChevronLeft,
  Copy,
  Link2,
  LogOut,
  Mic,
  MicOff,
  TriangleAlert,
  Users,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";

import CoworkVideoTile from "../components/CoworkVideoTile";
import DashboardLayout from "../components/DashboardLayout";
import { PendingLabel } from "../components/PendingLabel";
import type { PaletteCommand } from "../components/ModuleCommandPalette";
import { usePalette, useRegisterPaletteCommands } from "../context/PaletteContext";
import { BannerSpinner, StatusBanner } from "../components/cowork/StatusBanner";
import { RoomRail } from "../components/cowork/RoomRail";
import { Kbd } from "../components/tasks/Kbd";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useCoworkRoom } from "../hooks/useCoworkRoom";
import { useSfuRoom } from "../hooks/useSfuRoom";
import { getApiErrorMessage } from "../lib/api";
import { ApiCoworkSession, buildShareLink, coworkApi } from "../lib/coworkApi";
import { formatElapsed, formatExpiresIn, isExpiringSoon } from "../lib/coworkFormat";
import { buildPlan, locatePlanPosition } from "../lib/focusPlan";
import { SharedTask } from "../lib/coworkProtocol";
import { CMD_LABEL } from "../lib/platform";

// A sleeping Render free instance takes a while to answer the first request;
// after this long we stop looking broken and explain what is happening.
const COLD_START_HINT_MS = 3000;

/** Tile columns by how many people are in the room; one column on narrow screens. */
function gridColumns(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 9) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
}

export default function CoworkRoomPage() {
  const { slug } = useParams<{ slug: string }>();
  const { accessToken, user } = useAuth();
  const { tasks, updateTask, focusSessions } = useData();
  const navigate = useNavigate();

  // The shared clock in DataContext only ticks every 30s, which would leave the
  // elapsed counter sitting on 0:00 and then jumping. A room needs a real second hand.
  const [now, setNow] = useState(() => Date.now());
  // Once the room is over, "time together" is a record of what happened, not a
  // clock. Freeze it at the moment it ended — it used to keep climbing on the
  // ended screen, so a room you left at 12:04 read 40 minutes long if you sat
  // on that screen.
  const [endedAt, setEndedAt] = useState<number | null>(null);
  useEffect(() => {
    if (endedAt !== null) {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [endedAt]);

  const [room, setRoom] = useState<ApiCoworkSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showColdStartHint, setShowColdStartHint] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [sharedTaskIds, setSharedTaskIds] = useState<string[]>([]);
  // ⌘K and the palette itself now live in the shell; this page only needs to
  // know whether the palette is open so its own keys stay suppressed under it.
  const { open: isPaletteOpen } = usePalette();
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const joinedAtRef = useRef(Date.now());

  const connection = useCoworkRoom(loadError ? undefined : slug, accessToken);
  const mesh = useSfuRoom({
    slug: loadError ? undefined : slug,
    token: accessToken,
    connection,
    iceServers,
    enabled: Boolean(room) && !loadError,
  });

  // Whatever ends the room — this host's own button, another host's "room-ended"
  // frame, or a room that would not load at all — stops the clock at that instant.
  useEffect(() => {
    if (loadError || connection.fatalError) {
      setEndedAt(current => current ?? Date.now());
    }
  }, [loadError, connection.fatalError]);

  // --- room + ICE config ----------------------------------------------------

  useEffect(() => {
    if (!accessToken || !slug) {
      return;
    }

    let cancelled = false;
    const hintTimer = window.setTimeout(() => !cancelled && setShowColdStartHint(true), COLD_START_HINT_MS);

    Promise.all([coworkApi.get(accessToken, slug), coworkApi.iceConfig(accessToken)])
      .then(([loadedRoom, ice]) => {
        if (cancelled) {
          return;
        }
        setRoom(loadedRoom);
        setIceServers(
          ice.ice_servers.map(server => ({
            urls: server.urls,
            ...(server.username ? { username: server.username } : {}),
            ...(server.credential ? { credential: server.credential } : {}),
          })),
        );
      })
      .catch(error => {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error, "This cowork session is not available."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(hintTimer);
          setIsLoading(false);
          setShowColdStartHint(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(hintTimer);
    };
  }, [accessToken, slug]);

  // --- task sharing ---------------------------------------------------------

  const sharedTasks = useMemo(
    () => sharedTaskIds.map(id => tasks.find(task => task.id === id)).filter((task): task is NonNullable<typeof task> => Boolean(task)),
    [sharedTaskIds, tasks],
  );

  const sharedPayload = useMemo<SharedTask[]>(
    () => sharedTasks.map(task => ({ id: task.id, title: task.title, completed: task.completed })),
    [sharedTasks],
  );

  // Push the list whenever the selection changes or one of the shared tasks gets
  // completed — including when it was completed from the Tasks page in another tab.
  const shareTasks = connection.shareTasks;
  const lastSentRef = useRef("");
  useEffect(() => {
    if (connection.connectionState !== "connected") {
      return;
    }
    const fingerprint = JSON.stringify(sharedPayload);
    if (fingerprint === lastSentRef.current) {
      return;
    }
    lastSentRef.current = fingerprint;
    shareTasks(sharedPayload);
  }, [connection.connectionState, shareTasks, sharedPayload]);

  const handleComplete = useCallback(
    async (taskId: string, completed: boolean) => {
      // Goes through the normal task update, so finishing something here counts
      // everywhere else in the app too.
      await updateTask(taskId, {
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      });
    },
    [updateTask],
  );

  // --- host controls --------------------------------------------------------

  const handleEndRoom = async () => {
    if (!accessToken || !slug || isEndingRoom) {
      return;
    }
    // Ending disconnects everyone, so the button has to say the request is in
    // flight rather than sitting there looking unpressed.
    setIsEndingRoom(true);
    try {
      await coworkApi.end(accessToken, slug);
      toast.success("Room ended.");
      navigate("/cowork");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not end the room."));
      // Only on failure — success unmounts this page on the next line up.
      setIsEndingRoom(false);
    }
  };

  const copyLink = useCallback(async () => {
    if (!slug) {
      return;
    }
    try {
      await navigator.clipboard.writeText(buildShareLink(slug));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy automatically — select the link and copy it.");
    }
  }, [slug]);

  // --- derived --------------------------------------------------------------

  const remotePeers = connection.peers.filter(peer => peer.peer_id !== connection.selfPeerId);
  const isHost = room?.is_host ?? false;
  const here = remotePeers.length + 1;
  const hostPeerId =
    connection.peers.find(peer => peer.user_id === connection.room?.host_user_id)?.peer_id ?? null;
  const shareableTasks = tasks.filter(task => !task.completed && !sharedTaskIds.includes(task.id));
  const isStale = connection.connectionState === "reconnecting";

  const focusSession = useMemo(
    () => focusSessions.find(session => session.status === "active" || session.status === "paused") ?? null,
    [focusSessions],
  );
  const focusPosition = useMemo(() => {
    if (!focusSession) {
      return null;
    }
    const plan = buildPlan(
      focusSession.totalDurationMinutes,
      focusSession.focusLengthMinutes,
      focusSession.breakLengthMinutes,
    );
    return { plan, at: locatePlanPosition(plan.segments, focusSession.elapsedSeconds) };
  }, [focusSession]);

  // --- keyboard -------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isPaletteOpen) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target?.isContentEditable ?? false);
      if (isTyping) {
        return;
      }
      if (event.key === "Escape" && isConfirmingEnd) {
        event.preventDefault();
        setIsConfirmingEnd(false);
        return;
      }
      if (event.key === "Escape" && isSharePanelOpen) {
        event.preventDefault();
        setIsSharePanelOpen(false);
        return;
      }
      switch (event.key.toLowerCase()) {
        case "m":
          event.preventDefault();
          mesh.toggleMic();
          break;
        case "c":
          event.preventDefault();
          mesh.toggleCamera();
          break;
        case "s":
          event.preventDefault();
          setIsSharePanelOpen(open => !open);
          break;
        case "l":
          event.preventDefault();
          navigate("/cowork");
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const paletteCommands: PaletteCommand[] = useMemo(() => [
    {
      label: mesh.isMicOn ? "Mute microphone" : "Unmute microphone",
      icon: mesh.isMicOn ? <MicOff /> : <Mic />,
      shortcut: "M",
      run: mesh.toggleMic,
    },
    {
      label: mesh.isCameraOn ? "Stop camera" : "Start camera",
      icon: mesh.isCameraOn ? <VideoOff /> : <VideoIcon />,
      shortcut: "C",
      run: mesh.toggleCamera,
    },
    { label: "Copy room link", icon: <Link2 />, run: () => void copyLink() },
    { label: "Leave room", icon: <LogOut />, shortcut: "L", run: () => navigate("/cowork") },
    // Opens the same confirm popover the header uses rather than destroying
    // the room outright — one Enter in the palette used to disconnect everyone.
    ...(isHost
      ? [
          {
            label: "End room for everyone",
            icon: <Users />,
            destructive: true,
            run: () => setIsConfirmingEnd(true),
          },
        ]
      : []),
  ], [mesh, isHost, copyLink, navigate]);

  useRegisterPaletteCommands("Room", paletteCommands);

  // --- render ---------------------------------------------------------------

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <BannerSpinner />
          <p className="text-[13px] text-muted-foreground">Joining the room…</p>
          {showColdStartHint && (
            <p className="max-w-sm text-xs text-tertiary">
              The server is waking up — free-tier instances sleep when idle, so the first join of the day can
              take up to a minute.
            </p>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (loadError || connection.fatalError) {
    const completedHere =
      sharedPayload.filter(task => task.completed).length +
      remotePeers.reduce((sum, peer) => sum + peer.shared_tasks.filter(task => task.completed).length, 0);

    return (
      <DashboardLayout>
        <div className="mx-auto flex min-h-full max-w-[420px] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card">
            <Users className="h-4 w-4 text-tertiary" />
          </div>
          <h1 className="mt-3 text-[13.5px] font-semibold">
            {loadError ? "Room unavailable" : "Room ended"}
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-tertiary">
            {loadError ?? connection.fatalError}
          </p>
          {!loadError && (
            <p className="mt-1 text-[12.5px] text-tertiary">
              {room?.title} · {formatElapsed(joinedAtRef.current, endedAt ?? now)} together ·{" "}
              {completedHere} task{completedHere === 1 ? "" : "s"} completed
            </p>
          )}
          <Link
            to="/cowork"
            className="mt-4 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Back to lobby
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const expiringSoon = room ? isExpiringSoon(room.expires_at, now) : false;

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-2 sm:h-[46px] sm:px-3 sm:py-0">
          <Link
            to="/cowork"
            aria-label="Back to Cowork"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-[13px] font-semibold">{room?.title}</h1>
          <span className="min-w-0 truncate text-xs text-tertiary">
            {isHost ? "Hosted by you" : `Hosted by ${room?.host_name}`} · {here} of{" "}
            {connection.maxParticipants}
            {room ? ` · expires in ${formatExpiresIn(room.expires_at, now)}` : ""}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <Link2 className="h-3.5 w-3.5" />
            Copy link
          </button>
          {isHost ? (
            /* Ending a room disconnects everyone and permanently invalidates
               the link. The guide requires destructive actions to confirm, and
               the Cowork handoff specifies an anchored confirm popover — the
               lobby already does this; the room header used to fire on a
               single click with no undo. */
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsConfirmingEnd(current => !current)}
                aria-expanded={isConfirmingEnd}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                End room
              </button>
              {isConfirmingEnd && (
                <div
                  role="dialog"
                  aria-label="End this room?"
                  className="absolute right-0 top-full z-30 mt-1.5 w-[220px] rounded-lg border border-border bg-popover p-3 shadow-panel"
                >
                  <p className="text-[12.5px] leading-relaxed">
                    End this room? Everyone is disconnected and the link stops working.
                  </p>
                  <div className="mt-2.5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingEnd(false)}
                      disabled={isEndingRoom}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEndRoom()}
                      disabled={isEndingRoom}
                      aria-busy={isEndingRoom}
                      className="flex items-center gap-1.5 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-70"
                    >
                      <PendingLabel pending={isEndingRoom} pendingLabel="Ending…">
                        End room
                      </PendingLabel>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/cowork"
              className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Leave
            </Link>
          )}
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          {/* Stage */}
          <div className="flex min-w-0 flex-1 flex-col">
            {connection.connectionState === "connecting" && (
              <StatusBanner icon={<BannerSpinner />}>Connecting to the room…</StatusBanner>
            )}
            {connection.connectionState === "reconnecting" && (
              <StatusBanner icon={<BannerSpinner />}>
                Connection lost — reconnecting. Others may not see or hear you.
              </StatusBanner>
            )}
            {mesh.mediaError && (
              <StatusBanner
                icon={<VideoOff className="h-3.5 w-3.5 text-destructive" />}
                action={{ label: "Try again", onClick: mesh.retryMedia }}
              >
                {mesh.mediaError}
              </StatusBanner>
            )}
            {mesh.videoError && (
              <StatusBanner icon={<TriangleAlert className="h-3.5 w-3.5 text-priority-medium" />}>
                {mesh.videoError}
              </StatusBanner>
            )}
            {expiringSoon && room && (
              <StatusBanner
                icon={<TriangleAlert className="h-3.5 w-3.5 text-priority-medium" />}
                action={isHost ? { label: "End room now", onClick: () => void handleEndRoom() } : undefined}
              >
                This room link expires in {formatExpiresIn(room.expires_at, now)} — everyone will be
                disconnected.
              </StatusBanner>
            )}

            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <div className={`grid w-full gap-2.5 ${gridColumns(here)} ${here <= 1 ? "max-w-[680px]" : ""}`}>
                <CoworkVideoTile
                  displayName={user?.name ?? "You"}
                  stream={mesh.localStream}
                  isLocal
                  isHost={isHost}
                  isCameraOff={!mesh.isCameraOn}
                  isMuted={!mesh.isMicOn}
                  isBlocked={Boolean(mesh.mediaError)}
                  onRetryMedia={mesh.retryMedia}
                />
                {remotePeers.map(peer => (
                  <CoworkVideoTile
                    key={peer.peer_id}
                    displayName={peer.display_name}
                    stream={mesh.remoteMedia[peer.peer_id]?.stream ?? null}
                    connectionState={mesh.remoteMedia[peer.peer_id]?.connectionState}
                    isHost={peer.peer_id === hostPeerId}
                    isStale={isStale}
                    // No published tracks = no camera on their side: show initials and
                    // a camera-off marker, not an eternal "Connecting...".
                    isPublishing={peer.published_tracks.length > 0}
                    isCameraOff={peer.published_tracks.length === 0}
                  />
                ))}
              </div>

              {/* Being alone is a prompt to invite someone, not empty space */}
              {here === 1 && (
                <div className="mt-4 flex max-w-[680px] flex-wrap items-center justify-center gap-2 text-xs text-tertiary">
                  <span>You're the only one here — share the link:</span>
                  <code className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {slug ? buildShareLink(slug) : ""}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
              )}
            </div>

            {/* Control bar */}
            <div className="flex h-[52px] shrink-0 items-center gap-3 border-t border-border px-4">
              <span className="hidden w-24 shrink-0 font-mono text-[11px] text-tertiary sm:block">
                {formatElapsed(joinedAtRef.current, now)} elapsed
              </span>
              <div className="flex flex-1 items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={mesh.toggleMic}
                  aria-pressed={!mesh.isMicOn}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    mesh.isMicOn
                      ? "border-border bg-card text-muted-foreground hover:text-foreground"
                      : "border-destructive bg-destructive/10 text-destructive"
                  }`}
                >
                  {mesh.isMicOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  {mesh.isMicOn ? "Mic" : "Muted"}
                  <Kbd>M</Kbd>
                </button>
                <button
                  type="button"
                  onClick={mesh.toggleCamera}
                  aria-pressed={!mesh.isCameraOn}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    mesh.isCameraOn
                      ? "border-border bg-card text-muted-foreground hover:text-foreground"
                      : "border-destructive bg-destructive/10 text-destructive"
                  }`}
                >
                  {mesh.isCameraOn ? (
                    <VideoIcon className="h-3.5 w-3.5" />
                  ) : (
                    <VideoOff className="h-3.5 w-3.5" />
                  )}
                  {mesh.isCameraOn ? "Camera" : "Camera off"}
                  <Kbd>C</Kbd>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/cowork")}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave
                  <Kbd>L</Kbd>
                </button>
              </div>
              <span className="hidden w-24 shrink-0 text-right text-[11.5px] text-tertiary sm:block">
                {here} of {connection.maxParticipants} here
              </span>
            </div>
          </div>

          <RoomRail
            sharedTasks={sharedTasks}
            shareableTasks={shareableTasks}
            peers={remotePeers}
            hostPeerId={hostPeerId}
            isSelfHost={isHost}
            focusSession={focusSession}
            focusBlockNumber={focusPosition?.at.focusBlockNumber ?? 0}
            focusBlockTotal={focusPosition?.plan.focusCount ?? 0}
            isSharePanelOpen={isSharePanelOpen}
            onSharePanelChange={setIsSharePanelOpen}
            onShare={taskId => setSharedTaskIds(current => [...current, taskId])}
            onUnshare={taskId => setSharedTaskIds(current => current.filter(id => id !== taskId))}
            onComplete={task => void handleComplete(task.id, !task.completed)}
          />
        </div>

        {/* Shortcut footer */}
        <div className="mt-auto hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-1.5 text-[11px] text-tertiary sm:flex sm:px-4">
          <span className="flex items-center gap-1.5">
            <Kbd>M</Kbd> mic
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>C</Kbd> camera
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>S</Kbd> share a task
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>L</Kbd> leave
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>{CMD_LABEL} K</Kbd> commands
          </span>
        </div>

      </div>
    </DashboardLayout>
  );
}
