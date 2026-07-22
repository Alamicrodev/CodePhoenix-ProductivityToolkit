import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useData, Habit } from "../context/DataContext";
import { FlowShell } from "../components/flow/FlowShell";
import { FlowButton, FlowPanel, FlowSectionHeader, FlowStatCard } from "../components/flow/FlowPrimitives";
import { HabitModal } from "../components/HabitModal";
import { habitFrequencyLabel } from "../lib/flowHabits";
import { formatTimeOfDay, formatWhenLabel } from "../lib/flowFormat";
import { buildDayStatuses, buildScoreSeries, getCurrentScore, DayCellStatus } from "../lib/habitStats";
import { useFlowPrefs } from "../hooks/useFlowPrefs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

const DAY_HEADS_SUN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_HEADS_MON = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface CheckinRow {
  key: string;
  when: string;
  note: string;
  time: string;
  skipped: boolean;
}

function buildCheckins(habit: Habit, now: Date, limit = 8): CheckinRow[] {
  const completions = habit.completedDates.map(timestamp => ({
    timestamp,
    skipped: false,
  }));
  const skips = (habit.occurrences ?? [])
    .filter(occurrence => occurrence.status === "skipped")
    .map(occurrence => ({ timestamp: occurrence.timestamp, skipped: true }));

  return [...completions, ...skips]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
    .map(entry => ({
      key: `${entry.timestamp}-${entry.skipped}`,
      when: formatWhenLabel(entry.timestamp, now),
      note: entry.skipped ? "Skipped" : habit.description || "",
      time: entry.skipped ? "—" : formatTimeOfDay(entry.timestamp),
      skipped: entry.skipped,
    }));
}

function squareStyle(status: DayCellStatus | "future", isToday: boolean) {
  const background =
    status === "completed" || status === "partial"
      ? "var(--f-done)"
      : status === "skipped"
        ? "var(--f-med)"
        : status === "future"
          ? "transparent"
          : "var(--f-panel2)";
  const border = isToday
    ? "1px solid var(--f-accent)"
    : status === "future"
      ? "1px solid var(--f-border2)"
      : status === "completed" || status === "partial" || status === "skipped"
        ? "none"
        : "1px solid var(--f-border)";
  const color =
    status === "completed" || status === "partial" || status === "skipped"
      ? "rgba(255,255,255,0.85)"
      : "var(--f-text3)";
  return { background, border, color };
}

export default function HabitDetailPage() {
  const { habitId } = useParams<{ habitId: string }>();
  const { habits, deleteHabit, isSyncing, isWorkspaceLoading, currentTime } = useData();
  const { weekStart } = useFlowPrefs();
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const habit = habits.find(item => item.id === habitId);
  const now = useMemo(() => new Date(currentTime), [currentTime]);
  const [monthCursor, setMonthCursor] = useState(() => ({
    year: now.getFullYear(),
    month: now.getMonth(),
  }));

  const score = useMemo(() => (habit ? getCurrentScore(habit, now) : 0), [habit, now]);
  const scoreDelta = useMemo(() => {
    if (!habit) return 0;
    const series = buildScoreSeries(habit, now);
    if (series.length < 8) return 0;
    const weekAgo = series[series.length - 8]?.score ?? 0;
    return Math.round((series[series.length - 1].score - weekAgo) * 100);
  }, [habit, now]);

  const calendar = useMemo(() => {
    if (!habit) return null;
    const { year, month } = monthCursor;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const statuses = buildDayStatuses(habit, now, monthStart, monthEnd);
    const startOffset = weekStart === "mon" ? 1 : 0;
    const pad = (monthStart.getDay() - startOffset + 7) % 7;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const cells = statuses.map(status => {
      const isFuture = status.date > today;
      return {
        key: status.key,
        day: status.date.getDate(),
        status: (isFuture ? "future" : status.status) as DayCellStatus | "future",
        isToday: status.date.getTime() === today.getTime(),
        tip: `${status.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${
          isFuture
            ? ""
            : status.status === "completed" || status.status === "partial"
              ? " · done"
              : status.status === "skipped"
                ? " · skipped"
                : status.status === "missed"
                  ? " · missed"
                  : ""
        }`,
      };
    });

    const elapsed = cells.filter(cell => cell.status !== "future").length;
    const logged = cells.filter(cell => cell.status === "completed" || cell.status === "partial").length;
    const label = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { pad, cells, elapsed, logged, label };
  }, [habit, monthCursor, now, weekStart]);

  const checkins = useMemo(() => (habit ? buildCheckins(habit, now) : []), [habit, now]);

  if (!habit) {
    return (
      <FlowShell title="Habits" meta={isWorkspaceLoading ? "Loading…" : undefined}>
        <div className="mx-auto w-full max-w-[840px] px-4 pt-[14px]">
          <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
            {isWorkspaceLoading ? "Loading habit…" : (
              <>
                Habit not found — it may have been deleted.{" "}
                <Link to="/habits" className="text-[var(--f-accent)]">Back to Habits</Link>
              </>
            )}
          </div>
        </div>
      </FlowShell>
    );
  }

  const moveMonth = (delta: number) => {
    setMonthCursor(cursor => {
      const next = new Date(cursor.year, cursor.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const dayHeads = weekStart === "mon" ? DAY_HEADS_MON : DAY_HEADS_SUN;

  return (
    <FlowShell
      title={
        <span className="flex items-center gap-3">
          <Link to="/habits" aria-label="Back to habits" className="text-[14px] text-[var(--f-text3)] hover:text-[var(--f-text)]">
            ←
          </Link>
          {habit.title}
          <span className="rounded border border-[var(--f-border)] px-[6px] py-[1px] text-[11px] font-normal text-[var(--f-accent)]">
            {habitFrequencyLabel(habit)}
          </span>
        </span>
      }
      actions={
        <>
          <FlowButton onClick={() => setIsDeleteOpen(true)} className="text-[var(--f-hi)] hover:text-[var(--f-hi)]">
            Delete
          </FlowButton>
          <FlowButton onClick={() => setIsEditOpen(true)}>Edit</FlowButton>
        </>
      }
    >
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
        {/* Stat strip */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <FlowStatCard label="Habit strength">
            {Math.round(score * 100)}%{" "}
            {scoreDelta !== 0 && (
              <span
                className="text-[11px] font-medium"
                style={{ color: scoreDelta > 0 ? "var(--f-done)" : "var(--f-hi)" }}
              >
                {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
              </span>
            )}
          </FlowStatCard>
          <FlowStatCard label="Current streak">
            {habit.streak} <span className="text-[11px] font-medium text-[var(--f-text3)]">days</span>
          </FlowStatCard>
          <FlowStatCard label="Total check-ins">{habit.completedDates.length}</FlowStatCard>
        </div>

        {/* Calendar */}
        {calendar && (
          <FlowPanel
            dotColor="var(--f-done)"
            title={calendar.label}
            meta={`${calendar.logged} of ${calendar.elapsed} days logged`}
            right={
              <span className="flex items-center">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => moveMonth(-1)}
                  className="cursor-pointer px-[6px] text-[var(--f-text3)] hover:text-[var(--f-text)]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => moveMonth(1)}
                  className="cursor-pointer px-[6px] text-[var(--f-text3)] hover:text-[var(--f-text)]"
                >
                  ›
                </button>
              </span>
            }
            className="mb-3"
          >
            <div className="px-[14px] py-3">
              <div className="grid justify-start gap-[5px]" style={{ gridTemplateColumns: "repeat(7, 22px)" }}>
                {dayHeads.map(head => (
                  <span key={head} className="text-center text-[10px] text-[var(--f-text3)]">
                    {head}
                  </span>
                ))}
                {Array.from({ length: calendar.pad }, (_, index) => (
                  <span key={`pad-${index}`} />
                ))}
                {calendar.cells.map(cell => {
                  const style = squareStyle(cell.status, cell.isToday);
                  return (
                    <div
                      key={cell.key}
                      title={cell.tip}
                      className="box-border flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-[9px]"
                      style={style}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-[14px] text-[11px] text-[var(--f-text3)]">
                <span className="flex items-center gap-[5px]">
                  <span className="h-[9px] w-[9px] rounded-[3px] bg-[var(--f-done)]" />Done
                </span>
                <span className="flex items-center gap-[5px]">
                  <span className="h-[9px] w-[9px] rounded-[3px] bg-[var(--f-med)]" />Skipped
                </span>
                <span className="flex items-center gap-[5px]">
                  <span className="box-border h-[9px] w-[9px] rounded-[3px] border border-[var(--f-border)] bg-[var(--f-panel2)]" />Missed
                </span>
                <span className="flex items-center gap-[5px]">
                  <span className="box-border h-[9px] w-[9px] rounded-[3px] border border-[var(--f-accent)]" />Today
                </span>
              </div>
            </div>
          </FlowPanel>
        )}

        {/* Recent check-ins */}
        <FlowSectionHeader>Recent check-ins</FlowSectionHeader>
        <div className="flex flex-col">
          {checkins.map(checkin => (
            <div key={checkin.key} className="flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)]">
              <div
                className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full text-[9px] text-white"
                style={{ background: checkin.skipped ? "var(--f-med)" : "var(--f-done)" }}
              >
                {checkin.skipped ? "–" : "✓"}
              </div>
              <span className="flex-1 font-medium">{checkin.when}</span>
              <span className="text-[12px] text-[var(--f-text3)]">{checkin.note}</span>
              <span className="w-[56px] text-right font-['Geist_Mono',ui-monospace,monospace] text-[11px] text-[var(--f-text3)]">
                {checkin.time}
              </span>
            </div>
          ))}
          {checkins.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
              No check-ins yet — check in from the Habits list.
            </div>
          )}
        </div>
      </div>

      <HabitModal
        key={`${habit.id}-${isEditOpen}`}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        habit={habit}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the habit from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteHabit(habit.id);
                toast.success(`Habit "${habit.title}" has been deleted`);
                navigate("/habits");
              }}
              disabled={isSyncing}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FlowShell>
  );
}
