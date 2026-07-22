import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useData, Habit } from "../context/DataContext";
import { FlowShell } from "../components/flow/FlowShell";
import { FlowPrimaryButton, FlowSectionHeader } from "../components/flow/FlowPrimitives";
import { QuickAdd } from "../components/flow/QuickAdd";
import { KbdChip } from "../components/flow/KbdChip";
import {
  habitFrequencyLabel,
  parseHabitQuickAdd,
  trailingWeekLabels,
  trailingWeekSquares,
} from "../lib/flowHabits";
import { isHabitCheckedToday } from "../lib/flowSchedule";
import { findCompletionMarkerForDay } from "../lib/habitStats";

function HabitRow({
  habit,
  onToggle,
  onOpen,
}: {
  habit: Habit;
  onToggle: (habit: Habit) => void;
  onOpen: (habit: Habit) => void;
}) {
  const now = new Date();
  const checkedToday = isHabitCheckedToday(habit, now);
  const squares = trailingWeekSquares(habit, now);

  return (
    <div className="flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)]">
      <button
        type="button"
        role="checkbox"
        aria-checked={checkedToday}
        aria-label={`Check in "${habit.title}"`}
        title="Check in today"
        onClick={() => onToggle(habit)}
        className={`flex h-[15px] w-[15px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[9px] text-white ${
          checkedToday ? "bg-[var(--f-done)]" : "border-[1.5px] border-[var(--f-text3)] hover:border-[var(--f-done)]"
        }`}
      >
        {checkedToday ? "✓" : ""}
      </button>
      <div
        className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2"
        onClick={() => onOpen(habit)}
      >
        <span className="truncate font-medium">{habit.title}</span>
        <span className="whitespace-nowrap text-[12px] text-[var(--f-text3)]">
          {habitFrequencyLabel(habit)}
        </span>
      </div>
      <div className="hidden gap-[6px] sm:flex">
        {squares.map(square => (
          <div
            key={square.key}
            title={square.label}
            className="box-border h-[13px] w-[13px] rounded"
            style={{
              background:
                square.state === "done"
                  ? "var(--f-done)"
                  : square.state === "skipped"
                    ? "var(--f-med)"
                    : "var(--f-panel2)",
              border: square.isToday
                ? "1px solid var(--f-accent)"
                : square.state === "empty"
                  ? "1px solid var(--f-border)"
                  : "none",
            }}
          />
        ))}
      </div>
      <span className="w-[44px] whitespace-nowrap text-right text-[12px] text-[var(--f-text3)]">
        ● {habit.streak}d
      </span>
    </div>
  );
}

export default function HabitsPage() {
  const { habits, addHabit, completeHabit, undoCompleteHabit } = useData();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const quickAddRef = useRef<HTMLInputElement>(null);

  const bestStreak = Math.max(...habits.map(habit => habit.streak), 0);
  const weekLabels = useMemo(() => trailingWeekLabels(), []);

  const focusQuickAdd = useCallback(() => {
    window.setTimeout(() => quickAddRef.current?.focus(), 30);
  }, []);

  const handleQuickAdd = useCallback(() => {
    const parsed = parseHabitQuickAdd(draft);
    if (!parsed) return;
    setDraft("");
    void addHabit({
      title: parsed.title,
      description: parsed.description,
      frequency: parsed.frequency,
      activeDays: parsed.activeDays,
      streak: 0,
      lastCompleted: null,
      completedDates: [],
      occurrences: [],
    });
  }, [addHabit, draft]);

  const handleToggle = useCallback(
    (habit: Habit) => {
      if (isHabitCheckedToday(habit)) {
        const marker = findCompletionMarkerForDay(habit, new Date());
        if (marker) void undoCompleteHabit(habit.id, marker);
      } else {
        void completeHabit(habit.id);
      }
    },
    [completeHabit, undoCompleteHabit],
  );

  // 1–9 checks in the corresponding row (only when not yet checked).
  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = { c: focusQuickAdd };
    habits.slice(0, 9).forEach((habit, index) => {
      map[String(index + 1)] = () => {
        if (!isHabitCheckedToday(habit)) void completeHabit(habit.id);
      };
    });
    return map;
  }, [completeHabit, focusQuickAdd, habits]);

  return (
    <FlowShell
      title="Habits"
      meta={`${habits.length} active · best streak ${bestStreak}d`}
      shortcuts={shortcuts}
      footerHints={[
        { keys: "C", label: "new habit" },
        { keys: "⌘K", label: "commands" },
        { keys: "1–9", label: "check in a habit by row" },
        { keys: "G", label: "then D/H/F/C/S/P go to module" },
        { keys: "T", label: "theme" },
      ]}
      actions={
        <FlowPrimaryButton onClick={focusQuickAdd}>
          <span>New habit</span>
          <KbdChip onAccent>C</KbdChip>
        </FlowPrimaryButton>
      }
    >
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
        <QuickAdd
          ref={quickAddRef}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleQuickAdd}
          placeholder={'Add a habit…  try "meditate 10m every weekday"'}
        />

        {/* Section header with weekday initials aligned over the squares */}
        <div className="flex items-center gap-[10px] px-2 pb-[6px] pt-[2px]">
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--f-text3)]">
            Active · {habits.length}
          </span>
          <div className="hidden gap-[6px] sm:flex">
            {weekLabels.map((day, index) => (
              <span
                key={index}
                className={`w-[13px] text-center text-[10px] ${
                  day.isToday ? "font-semibold text-[var(--f-accent)]" : "text-[var(--f-text3)]"
                }`}
              >
                {day.label}
              </span>
            ))}
          </div>
          <span className="w-[44px]" />
        </div>

        <div className="flex flex-col">
          {habits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onToggle={handleToggle}
              onOpen={entry => navigate(`/habits/${entry.id}`)}
            />
          ))}
          {habits.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
              No habits yet — press C to add your first one.
            </div>
          )}
        </div>

        {habits.length > 0 && (
          <p className="mx-2 mt-4 text-[12px] text-[var(--f-text3)]">
            Squares show the trailing week — green done, amber skipped, outlined today. Press{" "}
            <KbdChip>{habits.length === 1 ? "1" : `1–${Math.min(habits.length, 9)}`}</KbdChip> to
            check in a habit by row.
          </p>
        )}
      </div>
    </FlowShell>
  );
}
