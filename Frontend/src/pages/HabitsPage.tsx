import { useCallback, useEffect, useMemo, useRef } from "react";
import { LayoutGrid, Plus, Table } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { ViewHeader } from "../components/shell/ViewHeader";
import { ShortcutFooter } from "../components/shell/ShortcutFooter";
import { Segmented } from "../components/ui/segmented";
import { HabitQuickAdd, HabitQuickAddHandle } from "../components/habits/HabitQuickAdd";
import { HabitRow } from "../components/habits/HabitRow";
import { HabitMatrix } from "../components/HabitMatrix";
import { useData } from "../context/DataContext";
import { useRegisterPaletteCommands } from "../context/PaletteContext";
import type { PaletteCommand } from "../components/ModuleCommandPalette";
import { usePersistentState } from "../hooks/usePersistentState";
import { buildDayStatuses, findCompletionMarkerForDay } from "../lib/habitStats";
import { addDays, startOfLocalDay } from "../lib/habitSchedule";
import { CMD_LABEL } from "../lib/platform";

type HabitsViewMode = "list" | "matrix";
const isViewMode = (v: unknown): v is HabitsViewMode => v === "list" || v === "matrix";

export default function HabitsPage() {
  const { habits, completeHabit, undoCompleteHabit } = useData();
  const [viewMode, setViewMode] = usePersistentState<HabitsViewMode>(
    "habits.viewMode",
    "list",
    isViewMode,
  );
  const quickAddRef = useRef<HabitQuickAddHandle>(null);

  const now = useMemo(() => new Date(), []);
  const today = startOfLocalDay(now);

  /** The trailing seven days, oldest first, for every habit's dot strip. */
  const weekByHabit = useMemo(() => {
    const from = addDays(today, -6);
    return new Map(
      habits.map(habit => [habit.id, buildDayStatuses(habit, now, from, today)] as const),
    );
  }, [habits, now, today]);

  const isCheckedToday = useCallback(
    (habitId: string) => {
      const habit = habits.find(h => h.id === habitId);
      return habit ? Boolean(findCompletionMarkerForDay(habit, now)) : false;
    },
    [habits, now],
  );

  const toggleToday = useCallback(
    (habitId: string) => {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;
      const marker = findCompletionMarkerForDay(habit, now);
      if (marker) {
        void undoCompleteHabit(habit.id, marker);
      } else {
        void completeHabit(habit.id);
      }
    },
    [habits, now, completeHabit, undoCompleteHabit],
  );

  const focusQuickAdd = useCallback(() => quickAddRef.current?.focus(), []);

  /* --------------------------------- keyboard -------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target?.isContentEditable ?? false);
      if (isTyping || document.querySelector('[role="dialog"]')) return;

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        focusQuickAdd();
        return;
      }
      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        setViewMode(mode => (mode === "list" ? "matrix" : "list"));
        return;
      }
      // "Shortcut: number keys check in" — 1-9 tick the corresponding row.
      if (/^[1-9]$/.test(event.key)) {
        const habit = habits[Number(event.key) - 1];
        if (habit) {
          event.preventDefault();
          toggleToday(habit.id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [habits, focusQuickAdd, setViewMode, toggleToday]);

  const paletteCommands = useMemo<PaletteCommand[]>(
    () => [
      { label: "New habit", icon: <Plus />, shortcut: "C", run: focusQuickAdd },
      {
        label: viewMode === "list" ? "Switch to matrix" : "Switch to list",
        icon: viewMode === "list" ? <Table /> : <LayoutGrid />,
        shortcut: "V",
        run: () => setViewMode(mode => (mode === "list" ? "matrix" : "list")),
      },
    ],
    [focusQuickAdd, viewMode, setViewMode],
  );
  useRegisterPaletteCommands("Habits", paletteCommands);

  const bestStreak = habits.reduce((max, habit) => Math.max(max, habit.streak), 0);

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        <ViewHeader
          title="Habits"
          meta={`${habits.length} active${bestStreak > 0 ? ` · best streak ${bestStreak}d` : ""}`}
          actions={
            <Segmented<HabitsViewMode>
              ariaLabel="Habits view"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "list", label: "List", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                { value: "matrix", label: "Matrix", icon: <Table className="h-3.5 w-3.5" /> },
              ]}
            />
          }
        />

        <div className="mx-auto w-full max-w-[840px] flex-1 px-4 pb-10 pt-4">
          <HabitQuickAdd ref={quickAddRef} />

          {viewMode === "matrix" ? (
            <div className="mt-4">
              <HabitMatrix habits={habits} />
            </div>
          ) : habits.length === 0 ? (
            /* One muted line naming the shortcut — no illustration, no card. */
            <p className="px-2 py-6 text-xs text-tertiary">Press C to add your first habit.</p>
          ) : (
            <div className="mt-3">
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
                Active · {habits.length}
              </div>
              {habits.map((habit, index) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  index={index + 1}
                  week={weekByHabit.get(habit.id) ?? []}
                  isCheckedToday={isCheckedToday(habit.id)}
                  onToggleToday={() => toggleToday(habit.id)}
                />
              ))}
            </div>
          )}
        </div>

        <ShortcutFooter
          items={[
            { keys: "C", label: "new habit" },
            { keys: `${CMD_LABEL} K`, label: "commands" },
            { keys: "V", label: "switch view" },
            { keys: "1–9", label: "check in", wide: true },
            { keys: "T", label: "theme", wide: true },
          ]}
        />
      </div>
    </DashboardLayout>
  );
}
