import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useData, FocusSession } from "../context/DataContext";
import { FlowShell } from "../components/flow/FlowShell";
import {
  FlowButton,
  FlowCheckRow,
  FlowPrimaryButton,
  FlowSectionHeader,
} from "../components/flow/FlowPrimitives";
import { QuickAdd } from "../components/flow/QuickAdd";
import { KbdChip } from "../components/flow/KbdChip";
import { parseFocusQuickAdd } from "../lib/flowFocus";
import {
  formatClock12,
  formatMinutesShort,
  formatSecondsClock,
  formatWhenLabel,
} from "../lib/flowFormat";

function startOfWeek(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export default function FocusPage() {
  const {
    tasks,
    habits,
    focusSessions,
    createFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    completeFocusSession,
    quitFocusSession,
    markFocusSessionItemComplete,
  } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  const activeTasks = useMemo(() => tasks.filter(task => !task.completed), [tasks]);
  const activeSession = useMemo(
    () => focusSessions.find(session => session.status === "active"),
    [focusSessions],
  );
  const pausedSessions = useMemo(
    () => focusSessions.filter(session => session.status === "paused"),
    [focusSessions],
  );
  const currentSession = activeSession ?? pausedSessions[0] ?? null;

  const weekStats = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const thisWeek = focusSessions.filter(session => new Date(session.startedAt) >= weekStart);
    const minutes = Math.round(thisWeek.reduce((sum, session) => sum + session.elapsedSeconds, 0) / 60);
    return { minutes, count: thisWeek.length };
  }, [focusSessions]);

  const history = useMemo(
    () =>
      focusSessions
        .filter(session => session.status === "completed" || session.status === "quit")
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 10),
    [focusSessions],
  );

  const focusQuickAdd = useCallback(() => {
    window.setTimeout(() => quickAddRef.current?.focus(), 30);
  }, []);

  useEffect(() => {
    const state = location.state as { quickAdd?: boolean } | null;
    if (state?.quickAdd) {
      focusQuickAdd();
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleQuickAdd = useCallback(() => {
    const parsed = parseFocusQuickAdd(draft, activeTasks);
    if (!parsed || activeSession) return;
    setDraft("");
    void createFocusSession({
      totalDurationMinutes: parsed.totalMinutes,
      focusLengthMinutes: parsed.focusMinutes,
      breakLengthMinutes: parsed.breakMinutes,
      taskIds: parsed.taskIds,
      habitIds: [],
    });
  }, [activeSession, activeTasks, createFocusSession, draft]);

  const togglePause = useCallback(() => {
    if (!currentSession) return;
    if (currentSession.status === "active") {
      void pauseFocusSession(currentSession.id);
    } else {
      void resumeFocusSession(currentSession.id);
    }
  }, [currentSession, pauseFocusSession, resumeFocusSession]);

  const isItemDone = useCallback(
    (session: FocusSession, item: FocusSession["items"][number]) => {
      if (item.completedInSessionAt) return true;
      if (item.sourceType === "task") {
        return Boolean(tasks.find(task => task.id === item.sourceId)?.completed);
      }
      return false;
    },
    [tasks],
  );

  const endSession = useCallback(() => {
    if (!currentSession) return;
    const allDone =
      currentSession.items.length > 0 &&
      currentSession.items.every(item => isItemDone(currentSession, item));
    if (allDone) {
      void completeFocusSession(currentSession.id);
    } else {
      void quitFocusSession(currentSession.id);
    }
  }, [completeFocusSession, currentSession, isItemDone, quitFocusSession]);

  const shortcuts = useMemo(
    () => ({
      f: focusQuickAdd,
      " ": togglePause,
    }),
    [focusQuickAdd, togglePause],
  );

  const sessionMeta = useMemo(() => {
    if (!currentSession) return null;
    const cycleMinutes = currentSession.focusLengthMinutes + currentSession.breakLengthMinutes;
    const totalBlocks = Math.max(1, Math.ceil(currentSession.totalDurationMinutes / cycleMinutes));
    const currentBlock = Math.min(
      currentSession.completedFocusBlocks + (currentSession.phaseType === "focus" ? 1 : 0),
      totalBlocks,
    );
    const remainingSeconds =
      currentSession.totalDurationMinutes * 60 - currentSession.elapsedSeconds;
    const endsAt = new Date(Date.now() + remainingSeconds * 1000);
    const phaseNote =
      currentSession.phaseType === "focus"
        ? `break in ${formatMinutesShort(Math.ceil(currentSession.phaseRemainingSeconds / 60))}`
        : `focus resumes in ${formatMinutesShort(Math.ceil(currentSession.phaseRemainingSeconds / 60))}`;
    const title =
      currentSession.items.find(item => !isItemDone(currentSession, item))?.title ??
      currentSession.title;
    return {
      title,
      line: `Focus ${currentBlock} of ${totalBlocks} · ${phaseNote} · ends ${formatClock12(endsAt)}`,
      progress: Math.min(
        100,
        (currentSession.elapsedSeconds / (currentSession.totalDurationMinutes * 60)) * 100,
      ),
    };
  }, [currentSession, isItemDone]);

  return (
    <FlowShell
      title="Focus"
      meta={`${formatMinutesShort(weekStats.minutes)} this week · ${weekStats.count} session${weekStats.count === 1 ? "" : "s"}`}
      shortcuts={shortcuts}
      footerHints={[
        { keys: "F", label: "plan a session" },
        { keys: "␣", label: "pause / resume" },
        { keys: "⌘K", label: "commands" },
        { keys: "G", label: "then D/H/F/C/S/P go to module" },
        { keys: "T", label: "theme" },
      ]}
      actions={
        <FlowPrimaryButton onClick={focusQuickAdd}>
          <span>Start session</span>
          <KbdChip onAccent>F</KbdChip>
        </FlowPrimaryButton>
      }
    >
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
        {/* Active / paused session */}
        {currentSession && sessionMeta && (
          <div className="mb-3 rounded-[10px] border border-[var(--f-border)] bg-[var(--f-panel)] px-4 py-[14px]">
            <div className="flex items-center gap-[14px]">
              <span className="font-['Geist_Mono',ui-monospace,monospace] text-[26px] font-medium">
                {formatSecondsClock(currentSession.phaseRemainingSeconds)}
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{sessionMeta.title}</div>
                <div className="text-[11.5px] text-[var(--f-text3)]">
                  {currentSession.status === "paused" ? "Paused · " : ""}
                  {sessionMeta.line}
                </div>
              </div>
              <div className="flex-1" />
              <FlowPrimaryButton onClick={togglePause} className="px-3">
                {currentSession.status === "active" ? "Pause" : "Resume"}
                <KbdChip onAccent className="px-1">␣</KbdChip>
              </FlowPrimaryButton>
              <FlowButton onClick={endSession}>End</FlowButton>
            </div>
            <div className="mt-3 h-[3px] overflow-hidden rounded-[2px] bg-[var(--f-border)]">
              <div
                className="h-full bg-[var(--f-accent)]"
                style={{ width: `${sessionMeta.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Session planning quick-add */}
        {!activeSession && (
          <QuickAdd
            ref={quickAddRef}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={handleQuickAdd}
            placeholder={'Plan a session…  try "2h on roadmap review, 25/5"'}
            hint="↵ to start · defaults 25m / 5m"
          />
        )}

        {/* In this session */}
        {currentSession && currentSession.items.length > 0 && (
          <>
            <FlowSectionHeader>In this session · {currentSession.items.length}</FlowSectionHeader>
            <div className="mb-4 flex flex-col">
              {currentSession.items.map(item => {
                const done = isItemDone(currentSession, item);
                const habit = item.sourceType === "habit" ? habits.find(entry => entry.id === item.sourceId) : undefined;
                const duration = habit?.description && /^\d+[mh]$/.test(habit.description) ? habit.description : "";
                return (
                  <FlowCheckRow
                    key={item.id}
                    done={done}
                    title={item.title}
                    tag={
                      item.sourceType === "task"
                        ? { label: "Task", colorVar: "--f-accent" }
                        : { label: "Habit", colorVar: "--f-done" }
                    }
                    right={
                      <span className="w-[44px] text-right font-['Geist_Mono',ui-monospace,monospace] text-[11px] text-[var(--f-text3)]">
                        {duration}
                      </span>
                    }
                    onToggle={
                      done ? undefined : () => void markFocusSessionItemComplete(currentSession.id, item.id)
                    }
                  />
                );
              })}
            </div>
          </>
        )}

        {/* History */}
        <FlowSectionHeader>History</FlowSectionHeader>
        <div className="flex flex-col">
          {history.map(session => {
            const doneCount = session.items.filter(item => item.completedInSessionAt).length;
            return (
              <div
                key={session.id}
                className="flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)]"
              >
                <span className="w-[60px] font-['Geist_Mono',ui-monospace,monospace] text-[11px] text-[var(--f-text3)]">
                  {formatWhenLabel(session.startedAt)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{session.title}</span>
                <span className="text-[12px] text-[var(--f-text3)]">
                  {session.status === "quit" && doneCount === 0
                    ? "ended early"
                    : `${doneCount} ${doneCount === 1 ? "item" : "items"} done`}
                </span>
                <span className="w-[56px] text-right font-['Geist_Mono',ui-monospace,monospace] text-[11px] text-[var(--f-text3)]">
                  {formatMinutesShort(Math.round(session.elapsedSeconds / 60))}
                </span>
              </div>
            );
          })}
          {history.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
              No sessions yet — press F to start one.
            </div>
          )}
        </div>
      </div>
    </FlowShell>
  );
}
