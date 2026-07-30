import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Mic,
  MicOff,
  ShieldAlert,
  Video as VideoIcon,
  VideoOff,
  XCircle,
} from "lucide-react";

import CoworkVideoTile from "../components/CoworkVideoTile";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useCoworkRoom } from "../hooks/useCoworkRoom";
import { useSfuRoom } from "../hooks/useSfuRoom";
import { getApiErrorMessage } from "../lib/api";
import { ApiCoworkSession, coworkApi } from "../lib/coworkApi";
import { SharedTask } from "../lib/coworkProtocol";

// A sleeping Render free instance takes a while to answer the first request;
// after this long we stop looking broken and explain what is happening.
const COLD_START_HINT_MS = 3000;

export default function CoworkRoomPage() {
  const { slug } = useParams<{ slug: string }>();
  const { accessToken, user } = useAuth();
  const { tasks, updateTask } = useData();
  const navigate = useNavigate();

  const [room, setRoom] = useState<ApiCoworkSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showColdStartHint, setShowColdStartHint] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [sharedTaskIds, setSharedTaskIds] = useState<string[]>([]);

  const connection = useCoworkRoom(loadError ? undefined : slug, accessToken);
  const mesh = useSfuRoom({
    slug: loadError ? undefined : slug,
    token: accessToken,
    connection,
    iceServers,
    enabled: Boolean(room) && !loadError,
  });

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

  const sharedTasks = useMemo<SharedTask[]>(
    () =>
      tasks
        .filter(task => sharedTaskIds.includes(task.id))
        .map(task => ({ id: task.id, title: task.title, completed: task.completed })),
    [sharedTaskIds, tasks],
  );

  // Push the list whenever the selection changes or one of the shared tasks gets
  // completed — including when it was completed from the Tasks page in another tab.
  const shareTasks = connection.shareTasks;
  const lastSentRef = useRef("");
  useEffect(() => {
    if (connection.connectionState !== "connected") {
      return;
    }
    const fingerprint = JSON.stringify(sharedTasks);
    if (fingerprint === lastSentRef.current) {
      return;
    }
    lastSentRef.current = fingerprint;
    shareTasks(sharedTasks);
  }, [connection.connectionState, shareTasks, sharedTasks]);

  const toggleShared = useCallback((taskId: string) => {
    setSharedTaskIds(current =>
      current.includes(taskId) ? current.filter(id => id !== taskId) : [...current, taskId],
    );
  }, []);

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      // Goes through the normal task update, so finishing something here counts
      // everywhere else in the app too.
      await updateTask(taskId, { completed: true, completedAt: new Date().toISOString() });
    },
    [updateTask],
  );

  // --- host controls --------------------------------------------------------

  const handleEndRoom = async () => {
    if (!accessToken || !slug) {
      return;
    }
    try {
      await coworkApi.end(accessToken, slug);
      toast.success("Room ended.");
      navigate("/cowork");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not end the room."));
    }
  };

  // --- render ---------------------------------------------------------------

  const remotePeers = connection.peers.filter(peer => peer.peer_id !== connection.selfPeerId);
  const isHost = room?.is_host ?? false;
  const openTasks = tasks.filter(task => !task.completed || sharedTaskIds.includes(task.id));

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>Joining the room...</p>
          {showColdStartHint && (
            <p className="text-sm max-w-sm text-center">
              The server is waking up — free-tier instances sleep when idle, so the first join of the
              day can take up to a minute.
            </p>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-lg mx-auto text-center space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Room unavailable</h1>
          <p className="text-muted-foreground">{loadError}</p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/cowork">
              <ArrowLeft className="w-4 h-4" />
              Back to Cowork
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{room?.title}</h1>
            <p className="text-muted-foreground text-sm">
              Hosted by {room?.host_name} · {remotePeers.length + 1} of {connection.maxParticipants} here
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/cowork">
                <ArrowLeft className="w-4 h-4" />
                Leave
              </Link>
            </Button>
            {isHost && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-red-600 hover:text-red-700 dark:text-red-400"
                onClick={handleEndRoom}
              >
                <XCircle className="w-4 h-4" />
                End room
              </Button>
            )}
          </div>
        </div>

        {connection.fatalError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{connection.fatalError}</span>
          </div>
        )}

        {connection.connectionState === "reconnecting" && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
            <span>
              Reconnecting to the room. Video with people already connected keeps working.
            </span>
          </div>
        )}

        {mesh.mediaError && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p>{mesh.mediaError}</p>
              <Button size="sm" variant="outline" onClick={mesh.retryMedia}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {mesh.videoError && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-accent px-4 py-3 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{mesh.videoError}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CoworkVideoTile
            displayName={user?.name ?? "You"}
            stream={mesh.localStream}
            isLocal
            isCameraOff={!mesh.isCameraOn}
            isMuted={!mesh.isMicOn}
            sharedTasks={sharedTasks}
          />
          {remotePeers.map(peer => (
            <CoworkVideoTile
              key={peer.peer_id}
              displayName={peer.display_name}
              stream={mesh.remoteMedia[peer.peer_id]?.stream ?? null}
              connectionState={mesh.remoteMedia[peer.peer_id]?.connectionState}
              // No published tracks = no camera on their side: show initials and
              // a camera-off marker, not an eternal "Connecting...".
              isPublishing={peer.published_tracks.length > 0}
              isCameraOff={peer.published_tracks.length === 0}
              sharedTasks={peer.shared_tasks}
            />
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <Button variant={mesh.isMicOn ? "outline" : "secondary"} className="gap-2" onClick={mesh.toggleMic}>
            {mesh.isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {mesh.isMicOn ? "Mute" : "Unmute"}
          </Button>
          <Button
            variant={mesh.isCameraOn ? "outline" : "secondary"}
            className="gap-2"
            onClick={mesh.toggleCamera}
          >
            {mesh.isCameraOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            {mesh.isCameraOn ? "Stop video" : "Start video"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold">What you're working on</h2>
              <p className="text-sm text-muted-foreground">
                Nothing is shared until you pick it. Everyone in the room sees the tasks you tick here.
              </p>
            </div>

            {openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open tasks. Add some on the <Link to="/tasks" className="underline">Tasks</Link> page.
              </p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {openTasks.map(task => (
                  <li key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent">
                    <Checkbox
                      id={`share-${task.id}`}
                      checked={sharedTaskIds.includes(task.id)}
                      onCheckedChange={() => toggleShared(task.id)}
                    />
                    <label
                      htmlFor={`share-${task.id}`}
                      className={`flex-1 text-sm cursor-pointer ${
                        task.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {task.title}
                    </label>
                    {sharedTaskIds.includes(task.id) && !task.completed && (
                      <Button size="sm" variant="ghost" onClick={() => handleCompleteTask(task.id)}>
                        Done
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold">The room</h2>
            {remotePeers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody else is here yet. Share the link and they'll appear.
              </p>
            ) : (
              <ul className="space-y-4">
                {remotePeers.map(peer => (
                  <li key={peer.peer_id}>
                    <p className="font-medium text-sm">{peer.display_name}</p>
                    {peer.shared_tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Not sharing any tasks</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {peer.shared_tasks.map(task => (
                          <li
                            key={task.id}
                            className={`text-sm ${
                              task.completed ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {task.completed ? "✓" : "○"} {task.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
