import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useData, Habit, Task } from "../context/DataContext";
import { FlowShell } from "../components/flow/FlowShell";
import {
  FlowCheckRow,
  FlowPanel,
  FlowPrimaryButton,
  FlowSectionHeader,
  FlowStatCard,
} from "../components/flow/FlowPrimitives";
import { KbdChip } from "../components/flow/KbdChip";
import { formatHeaderDate, formatMinutesShort } from "../lib/flowFormat";
import {
  buildDayAgenda,
  endOfDay,
  habitsForToday,
  isHabitCheckedToday,
  startOfDay,
  upNextItem,
} from "../lib/flowSchedule";
import { findCompletionMarkerForDay } from "../lib/habitStats";
import { formatDueLabel } from "../lib/flowTasks";

function completedOnDay(task: Task, dayStart: Date, dayEnd: Date): boolean {
  if (!task.completedAt) return false;
  const completedAt = new Date(task.completedAt);
  return completedAt >= dayStart && completedAt <= dayEnd;
}

export default function DashboardPage() {
  const { tasks, habits, focusSessions, updateTask, completeHabit, undoCompleteHabit } = useData();
  const navigate = useNavigate();
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const tasksDoneToday = useMemo(
    () => tasks.filter(task => completedOnDay(task, dayStart, dayEnd)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks],
  );
  const tasksDoneYesterday = useMemo(() => {
    const yesterdayStart = new Date(dayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(dayStart.getTime() - 1);
    return tasks.filter(task => completedOnDay(task, yesterdayStart, yesterdayEnd)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);
  const doneDelta = tasksDoneToday - tasksDoneYesterday;

  const focusMinutesToday = useMemo(() => {
    const seconds = focusSessions
      .filter(session => new Date(session.startedAt) >= dayStart)
      .reduce((sum, session) => sum + session.elapsedSeconds, 0);
    return Math.round(seconds / 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSessions]);

  const todaysHabits = useMemo(() => habitsForToday(habits, now), [habits, now]);
  const habitsChecked = useMemo(
    () => todaysHabits.filter(habit => isHabitCheckedToday(habit, now)).length,
    [todaysHabits, now],
  );
  const bestStreak = Math.max(...habits.map(habit => habit.streak), 0);

  // TODAY: today's due tasks + tasks completed today + today's habit check-ins,
  // one dense mixed list — undone first, completed struck at the bottom.
  const todayItems = useMemo(() => {
    type Item = {
      key: string;
      kind: "task" | "habit";
      done: boolean;
      title: string;
      right: string;
      urgent: boolean;
      task?: Task;
      habit?: Habit;
    };
    const items: Item[] = [];

    tasks.forEach(task => {
      const dueToday = !task.completed && task.dueDate && formatDueLabel(task.dueDate, now)?.label === "Today";
      const doneToday = completedOnDay(task, dayStart, dayEnd);
      if (dueToday || doneToday) {
        items.push({
          key: `task-${task.id}`,
          kind: "task",
          done: task.completed,
          title: task.title,
          right: task.completed ? "" : "Today",
          urgent: !task.completed,
          task,
        });
      }
    });

    todaysHabits.forEach(habit => {
      items.push({
        key: `habit-${habit.id}`,
        kind: "habit",
        done: isHabitCheckedToday(habit, now),
        title: habit.title,
        right: "",
        urgent: false,
        habit,
      });
    });

    return items.sort((a, b) => Number(a.done) - Number(b.done));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, todaysHabits]);

  const agenda = useMemo(() => buildDayAgenda(tasks, habits, now), [tasks, habits, now]);
  const upNext = useMemo(() => upNextItem(agenda, now), [agenda, now]);

  const toggleTask = (task: Task) => {
    void updateTask(task.id, {
      completed: !task.completed,
      completedAt: task.completed ? null : new Date().toISOString(),
    });
  };

  const toggleHabit = (habit: Habit) => {
    if (isHabitCheckedToday(habit, now)) {
      const marker = findCompletionMarkerForDay(habit, now);
      if (marker) void undoCompleteHabit(habit.id, marker);
    } else {
      void completeHabit(habit.id);
    }
  };

  return (
    <FlowShell
      title="Dashboard"
      meta={formatHeaderDate(now)}
      actions={
        <FlowPrimaryButton onClick={() => navigate("/tasks", { state: { quickAdd: true } })}>
          <span>New task</span>
          <KbdChip onAccent>C</KbdChip>
        </FlowPrimaryButton>
      }
    >
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
        {/* Stat strip */}
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <FlowStatCard label="Tasks done today">
            {tasksDoneToday}{" "}
            {doneDelta !== 0 && (
              <span className="text-[11px] font-medium text-[var(--f-done)]">
                {doneDelta > 0 ? `+${doneDelta}` : doneDelta}
              </span>
            )}
          </FlowStatCard>
          <FlowStatCard label="Focus time">{formatMinutesShort(focusMinutesToday)}</FlowStatCard>
          <FlowStatCard label="Habits checked">
            {habitsChecked}
            <span className="text-[12px] font-normal text-[var(--f-text3)]">/{todaysHabits.length}</span>
          </FlowStatCard>
          <FlowStatCard label="Best streak">
            {bestStreak} <span className="text-[11px] font-medium text-[var(--f-text3)]">days</span>
          </FlowStatCard>
        </div>

        {/* Today */}
        <FlowSectionHeader>Today · {todayItems.length}</FlowSectionHeader>
        <div className="mb-4 flex flex-col">
          {todayItems.map(item => (
            <FlowCheckRow
              key={item.key}
              done={item.done}
              title={item.title}
              tag={
                item.kind === "task"
                  ? { label: "Task", colorVar: "--f-accent" }
                  : { label: "Habit", colorVar: "--f-done" }
              }
              right={
                <span
                  className="w-[70px] whitespace-nowrap text-right text-[12px]"
                  style={{ color: item.urgent ? "var(--f-hi)" : "var(--f-text3)" }}
                >
                  {item.right}
                </span>
              }
              onToggle={() => (item.task ? toggleTask(item.task) : item.habit && toggleHabit(item.habit))}
              onClick={
                item.kind === "habit" && item.habit
                  ? () => navigate(`/habits/${item.habit!.id}`)
                  : undefined
              }
            />
          ))}
          {todayItems.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
              Nothing scheduled for today — press C to add a task.
            </div>
          )}
        </div>

        {/* Up next */}
        {upNext && (
          <FlowPanel dotColor="var(--f-accent)" title="Up next" meta="from your schedule">
            <div className="flex items-center gap-[10px] px-3 py-2">
              <span className="font-['Geist_Mono',ui-monospace,monospace] text-[11px] text-[var(--f-text3)]">
                {upNext.time}
              </span>
              <span
                className="h-4 w-[3px] shrink-0 rounded-[2px]"
                style={{ background: `var(${upNext.colorVar})` }}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{upNext.title}</span>
              <Link to="/schedule" className="whitespace-nowrap text-[12px] text-[var(--f-accent)]">
                Open schedule →
              </Link>
            </div>
          </FlowPanel>
        )}
      </div>
    </FlowShell>
  );
}
