import { useCallback, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useData, Task } from "../context/DataContext";
import { FlowShell } from "../components/flow/FlowShell";
import { FlowButton, FlowPanel, FlowSectionHeader } from "../components/flow/FlowPrimitives";
import { KbdChip } from "../components/flow/KbdChip";
import { buildDayAgenda } from "../lib/flowSchedule";
import { autoCategorizeQuadrant, formatDueLabel } from "../lib/flowTasks";
import { formatHeaderDate, formatMinutesShort } from "../lib/flowFormat";

export default function SchedulePage() {
  const { tasks, habits, focusSessions, updateTask } = useData();
  const [dayOffset, setDayOffset] = useState(0);

  const now = new Date();
  const viewDate = useMemo(() => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    if (dayOffset === 0) return now;
    return date;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOffset]);

  const agenda = useMemo(() => {
    const items = buildDayAgenda(tasks, habits, viewDate);
    if (dayOffset < 0) return items.map(item => ({ ...item, done: true }));
    if (dayOffset > 0) return items.map(item => ({ ...item, done: false }));
    return items;
  }, [dayOffset, habits, tasks, viewDate]);

  const dueThisWeek = useMemo(() => {
    const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    return tasks
      .filter(task => !task.completed && task.dueDate && new Date(task.dueDate) <= weekAhead)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const insights = useMemo(() => {
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const tasksDoneThisWeek = tasks.filter(
      task => task.completedAt && new Date(task.completedAt) >= weekStart,
    ).length;
    const sessionsThisWeek = focusSessions.filter(
      session => new Date(session.startedAt) >= weekStart,
    );
    const focusMinutes = Math.round(
      sessionsThisWeek.reduce((sum, session) => sum + session.elapsedSeconds, 0) / 60,
    );
    return { tasksDoneThisWeek, sessionCount: sessionsThisWeek.length, focusMinutes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, focusSessions]);

  const completeTask = useCallback(
    (task: Task) => {
      void updateTask(task.id, { completed: true, completedAt: new Date().toISOString() });
    },
    [updateTask],
  );

  const optimizeDay = useCallback(() => {
    const uncategorized = tasks.filter(task => !task.completed && !task.quadrant);
    uncategorized.forEach(task => {
      void updateTask(task.id, { quadrant: autoCategorizeQuadrant(task) });
    });
    toast.success("Day optimized — schedule rebuilt from your current tasks and habits.");
  }, [tasks, updateTask]);

  const formatWeekDue = (task: Task) => {
    const label = formatDueLabel(task.dueDate, now);
    if (!label) return "";
    if (label.label === "Today" || label.label === "Tomorrow") return label.label;
    return new Date(task.dueDate!).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <FlowShell
      title="Schedule"
      meta={formatHeaderDate(viewDate)}
      actions={
        <>
          <div className="flex items-center gap-[2px] text-[var(--f-text3)]">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setDayOffset(offset => offset - 1)}
              className="cursor-pointer rounded-[5px] px-2 py-[2px] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setDayOffset(0)}
              className={`cursor-pointer rounded-[5px] px-2 py-[2px] text-[12px] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)] ${
                dayOffset === 0 ? "text-[var(--f-text)]" : ""
              }`}
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setDayOffset(offset => offset + 1)}
              className="cursor-pointer rounded-[5px] px-2 py-[2px] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)]"
            >
              ›
            </button>
          </div>
          <FlowButton onClick={optimizeDay}>
            <Sparkles className="h-3 w-3" />
            Optimize day
          </FlowButton>
        </>
      }
    >
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
        {/* Agenda */}
        <FlowSectionHeader>{dayOffset === 0 ? "Today" : formatHeaderDate(viewDate)}</FlowSectionHeader>
        <div className="mb-4 flex flex-col">
          {agenda.map(item => (
            <div
              key={`${item.id}-${item.startMinutes}`}
              className={`flex items-center gap-[10px] rounded-md px-2 py-[5px] hover:bg-[var(--f-hover)] ${
                item.done ? "opacity-[0.62]" : ""
              }`}
            >
              <span className="w-[80px] shrink-0 font-['Geist_Mono',ui-monospace,monospace] text-[11px] text-[var(--f-text3)]">
                {item.time}
              </span>
              <span
                className="h-4 w-[3px] shrink-0 rounded-[2px]"
                style={{ background: `var(${item.colorVar})` }}
              />
              <span className={`min-w-0 flex-1 truncate font-medium ${item.done ? "line-through" : ""}`}>
                {item.title}
              </span>
              {item.meta && (
                <span className="whitespace-nowrap text-[12px] text-[var(--f-text3)]">{item.meta}</span>
              )}
              <span
                className="whitespace-nowrap rounded border border-[var(--f-border)] px-[6px] py-[1px] text-[11px]"
                style={{ color: `var(${item.colorVar})` }}
              >
                {item.tag}
              </span>
            </div>
          ))}
          {agenda.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
              Nothing scheduled — press C to add a task and it will be slotted in.
            </div>
          )}
        </div>

        {/* Due this week */}
        {dueThisWeek.length > 0 && (
          <>
            <FlowSectionHeader>Due this week</FlowSectionHeader>
            <div className="mb-4 flex flex-col">
              {dueThisWeek.map(task => {
                const due = formatDueLabel(task.dueDate, now);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)]"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked="false"
                      aria-label={`Mark done "${task.title}"`}
                      onClick={() => completeTask(task)}
                      className="h-[15px] w-[15px] shrink-0 cursor-pointer rounded-full border-[1.5px] border-[var(--f-text3)] hover:border-[var(--f-done)]"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                    <span
                      className="whitespace-nowrap text-[12px]"
                      style={{ color: due?.urgent ? "var(--f-hi)" : "var(--f-text3)" }}
                    >
                      {formatWeekDue(task)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Insights */}
        <FlowPanel dotColor="var(--f-accent)" title="Insights" meta="from your last 4 weeks">
          <div className="flex flex-col gap-[6px] px-3 py-2 text-[12px] leading-normal text-[var(--f-text2)]">
            <span>
              Peak productivity window:{" "}
              <span className="font-medium text-[var(--f-text)]">10 AM – 12 PM</span> — deep work is
              scheduled there.
            </span>
            {insights.tasksDoneThisWeek > 0 && (
              <span>
                <span className="font-medium text-[var(--f-text)]">{insights.tasksDoneThisWeek}</span>{" "}
                task{insights.tasksDoneThisWeek === 1 ? "" : "s"} completed this week.
              </span>
            )}
            {insights.sessionCount === 0 ? (
              <span>
                0 focus sessions this week — press <KbdChip>F</KbdChip> to start one on your next
                block.
              </span>
            ) : (
              <span>
                <span className="font-medium text-[var(--f-text)]">{insights.sessionCount}</span>{" "}
                focus session{insights.sessionCount === 1 ? "" : "s"} this week totalling{" "}
                <span className="font-medium text-[var(--f-text)]">
                  {formatMinutesShort(insights.focusMinutes)}
                </span>
                .
              </span>
            )}
          </div>
        </FlowPanel>
      </div>
    </FlowShell>
  );
}
