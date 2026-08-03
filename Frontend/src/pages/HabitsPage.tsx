import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { ViewHeader } from "../components/shell/ViewHeader";
import { ShortcutFooter } from "../components/shell/ShortcutFooter";
import { HabitQuickAdd, HabitQuickAddHandle } from "../components/habits/HabitQuickAdd";
import { HabitModal, HabitModalSeed } from "../components/habits/HabitModal";
import { HabitMatrix } from "../components/HabitMatrix";
import { useData } from "../context/DataContext";
import { useRegisterPaletteCommands } from "../context/PaletteContext";
import type { PaletteCommand } from "../components/ModuleCommandPalette";
import { findCompletionMarkerForDay } from "../lib/habitStats";
import { ParsedHabitQuickAdd, parseHabitQuickAdd } from "../lib/habitQuickAdd";
import { CMD_LABEL } from "../lib/platform";

export default function HabitsPage() {
  const { habits, completeHabit, undoCompleteHabit } = useData();
  const quickAddRef = useRef<HabitQuickAddHandle>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSeed, setModalSeed] = useState<HabitModalSeed | undefined>();

  const now = useMemo(() => new Date(), []);

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

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    // So the next open starts blank rather than replaying the last draft.
    setModalSeed(undefined);
  }, []);

  /** ⌘↵ in the quick-add: open the full editor pre-filled from the parsed draft. */
  const handleOpenFullEditor = useCallback((parsed: ParsedHabitQuickAdd) => {
    setModalSeed({
      title: parsed.title,
      frequency: parsed.frequency,
      activeDays: parsed.activeDays,
    });
    setIsModalOpen(true);
  }, []);

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
      // "Shortcut: number keys check in" — 1-9 tick the corresponding matrix row.
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
  }, [habits, focusQuickAdd, toggleToday]);

  const paletteCommands = useMemo<PaletteCommand[]>(
    () => [
      // C stays pointed at the quick-add — the full editor is a separate,
      // explicitly labelled entry so it cannot hijack the primary create path.
      { label: "New habit", icon: <Plus />, shortcut: "C", run: focusQuickAdd },
      {
        label: "New habit in full editor",
        icon: <SlidersHorizontal />,
        shortcut: `${CMD_LABEL}↵`,
        run: () => handleOpenFullEditor(parseHabitQuickAdd("")),
      },
    ],
    [focusQuickAdd, handleOpenFullEditor],
  );
  useRegisterPaletteCommands("Habits", paletteCommands);

  const bestStreak = habits.reduce((max, habit) => Math.max(max, habit.streak), 0);

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        <ViewHeader
          title="Habits"
          meta={`${habits.length} active${bestStreak > 0 ? ` · best streak ${bestStreak}d` : ""}`}
        />

        <div className="mx-auto w-full max-w-[840px] flex-1 px-4 pb-10 pt-4">
          <HabitQuickAdd ref={quickAddRef} onOpenFull={handleOpenFullEditor} />

          {habits.length === 0 ? (
            /* One muted line naming the shortcut — no illustration, no card. */
            <p className="px-2 py-6 text-xs text-tertiary">Press C to add your first habit.</p>
          ) : (
            <div className="mt-4">
              <HabitMatrix habits={habits} />
            </div>
          )}

          <HabitModal isOpen={isModalOpen} onClose={handleCloseModal} seed={modalSeed} />
        </div>

        <ShortcutFooter
          items={[
            { keys: "C", label: "new habit" },
            { keys: `${CMD_LABEL} K`, label: "commands" },
            { keys: `${CMD_LABEL} ↵`, label: "full editor" },
            { keys: "1–9", label: "check in", wide: true },
            { keys: "T", label: "theme", wide: true },
          ]}
        />
      </div>
    </DashboardLayout>
  );
}
