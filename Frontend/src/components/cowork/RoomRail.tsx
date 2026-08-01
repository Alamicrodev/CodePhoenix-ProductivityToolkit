import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { EyeOff, Plus } from "lucide-react";

import { FocusSession, Task } from "../../context/DataContext";
import { CoworkPeer } from "../../lib/coworkProtocol";
import { formatClock, formatTimerDigits, sessionTitle } from "../../lib/focusPlan";
import { CircleCheckbox } from "../tasks/CircleCheckbox";
import { Kbd } from "../tasks/Kbd";

interface RoomRailProps {
  /** Tasks the user has chosen to share, in the order they were shared. */
  sharedTasks: Task[];
  /** Open tasks not currently shared, offered by the share panel. */
  shareableTasks: Task[];
  peers: CoworkPeer[];
  hostPeerId: string | null;
  /** True when the viewer is the host, which changes whose name carries the chip. */
  isSelfHost: boolean;
  /** The viewer's own running focus session, if any. */
  focusSession: FocusSession | null;
  focusBlockNumber: number;
  focusBlockTotal: number;
  isSharePanelOpen: boolean;
  onSharePanelChange: (open: boolean) => void;
  onShare: (taskId: string) => void;
  onUnshare: (taskId: string) => void;
  onComplete: (task: Task) => void;
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-0.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
      {children}
    </h2>
  );
}

/**
 * Remembers which shared task ids flipped to done since the last render so a
 * peer finishing something registers as movement rather than a silent diff.
 */
function useCompletionFlash(peers: CoworkPeer[]) {
  const [flashed, setFlashed] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nowDone = peers.flatMap(peer =>
      peer.shared_tasks.filter(task => task.completed).map(task => `${peer.peer_id}:${task.id}`),
    );
    const fresh = nowDone.filter(key => !seenRef.current.has(key));
    nowDone.forEach(key => seenRef.current.add(key));
    if (fresh.length === 0) {
      return;
    }
    setFlashed(current => [...current, ...fresh]);
    const timer = window.setTimeout(
      () => setFlashed(current => current.filter(key => !fresh.includes(key))),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [peers]);

  return flashed;
}

/** Right rail: what everyone in the room says they are working on. */
export function RoomRail({
  sharedTasks,
  shareableTasks,
  peers,
  hostPeerId,
  isSelfHost,
  focusSession,
  focusBlockNumber,
  focusBlockTotal,
  isSharePanelOpen,
  onSharePanelChange,
  onShare,
  onUnshare,
  onComplete,
}: RoomRailProps) {
  const flashed = useCompletionFlash(peers);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSharePanelOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        onSharePanelChange(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isSharePanelOpen, onSharePanelChange]);

  const doneCount = useMemo(() => sharedTasks.filter(task => task.completed).length, [sharedTasks]);

  return (
    <aside className="w-full shrink-0 overflow-y-auto border-t border-border px-3.5 py-4 lg:w-[300px] lg:border-l lg:border-t-0">
      {/* The viewer's own focus session, made visible while coworking */}
      {focusSession && (
        <div className="pb-[18px]">
          <SectionHeader>Your focus session</SectionHeader>
          <div className="rounded-lg border border-border bg-muted px-2.5 py-2">
            <div className="font-mono text-[13px] font-semibold text-primary">
              {formatTimerDigits(focusSession.phaseRemainingSeconds)}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-tertiary">
              <span className="min-w-0 truncate">
                {focusSession.phaseType === "focus"
                  ? `focus ${focusBlockNumber || 1} of ${focusBlockTotal}`
                  : "break"}{" "}
                ·{" "}
                {sessionTitle(
                  focusSession.totalDurationMinutes,
                  focusSession.focusLengthMinutes,
                  focusSession.breakLengthMinutes,
                )}
              </span>
              <Link to="/focus" className="ml-auto shrink-0 text-primary hover:underline">
                Open →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Your own shared tasks — these checks complete the task for real */}
      <SectionHeader>
        You · {sharedTasks.length} shared
        {sharedTasks.length > 0 ? ` · ${doneCount} done` : ""}
      </SectionHeader>
      {sharedTasks.length === 0 ? (
        <p className="px-0.5 py-1 text-[11.5px] text-tertiary">
          Nothing shared yet — only what you pick is visible to the room.
        </p>
      ) : (
        <div className="flex flex-col">
          {sharedTasks.map(task => (
            <div
              key={task.id}
              className="group flex items-center gap-2 rounded-md px-1 py-[5px] transition-colors hover:bg-accent/50"
            >
              <CircleCheckbox
                checked={task.completed}
                onToggle={() => onComplete(task)}
                label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                size="sm"
              />
              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  task.completed ? "text-muted-foreground line-through" : "font-medium"
                }`}
              >
                {task.title}
              </span>
              {task.completed && task.completedAt && (
                <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] text-done">
                  ✓ {formatClock(new Date(task.completedAt))}
                </span>
              )}
              <button
                type="button"
                onClick={() => onUnshare(task.id)}
                aria-label={`Stop sharing ${task.title}`}
                title="Stop sharing"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-tertiary opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <EyeOff className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => onSharePanelChange(!isSharePanelOpen)}
          aria-expanded={isSharePanelOpen}
          disabled={shareableTasks.length === 0}
          className="mt-1 flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[11.5px] text-tertiary transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Share a task…
          <span className="ml-auto">
            <Kbd>S</Kbd>
          </span>
        </button>
        {isSharePanelOpen && shareableTasks.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
            {shareableTasks.map(task => (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  onShare(task.id);
                  onSharePanelChange(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
              >
                <span className="min-w-0 flex-1 truncate text-xs">{task.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* One section per peer, read-only */}
      {peers.map(peer => {
        const done = peer.shared_tasks.filter(task => task.completed).length;
        return (
          <div key={peer.peer_id} className="pt-[18px]">
            <div className="flex items-center gap-1.5 px-0.5 pb-1">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-done" aria-hidden="true" />
              <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
                {peer.display_name}
                {!isSelfHost && peer.peer_id === hostPeerId ? " · Host" : ""}
              </h2>
              {peer.shared_tasks.length > 0 && (
                <span className="shrink-0 font-mono text-[10.5px] text-tertiary">
                  {done}/{peer.shared_tasks.length}
                </span>
              )}
            </div>
            {peer.shared_tasks.length === 0 ? (
              <p className="px-0.5 py-1 text-[11.5px] text-tertiary">Nothing shared yet.</p>
            ) : (
              <div className="flex flex-col">
                {peer.shared_tasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 rounded-md px-1 py-[5px] transition-colors duration-1000 ease-out ${
                      flashed.includes(`${peer.peer_id}:${task.id}`) ? "bg-done/15" : ""
                    }`}
                  >
                    <span
                      className={`flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[8px] ${
                        task.completed ? "border-done bg-done text-white" : "border-tertiary"
                      }`}
                      aria-hidden="true"
                    >
                      {task.completed ? "✓" : ""}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-xs ${
                        task.completed ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
