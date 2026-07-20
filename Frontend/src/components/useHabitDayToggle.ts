import { useState } from "react";
import { toast } from "sonner";
import type { Habit } from "../context/DataContext";
import { useData } from "../context/DataContext";
import type { HabitHistorySlot } from "../lib/habitSchedule";
import {
  backfillTimestampForDay,
  findCompletionMarkerForDay,
  findCompletionMarkerForSlot,
  findSkipTimestampForDay,
} from "../lib/habitStats";
import type { HabitDayStatus } from "../lib/habitStats";

export function useHabitDayToggle(habit: Habit) {
  const { completeHabit, undoCompleteHabit, updateHabit } = useData();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const completeWithUndoToast = async (timestamp: Date) => {
    const marker = await completeHabit(habit.id, timestamp);

    if (marker) {
      toast.success(`Habit "${habit.title}" marked as complete!`, {
        action: {
          label: "Undo",
          onClick: () => {
            void undoCompleteHabit(habit.id, marker);
            toast.info("Habit completion undone");
          },
        },
        duration: 5000,
      });
    }
  };

  const toggleDay = async (day: HabitDayStatus) => {
    if (!day.toggleable || busyKey) {
      return;
    }

    setBusyKey(day.key);
    try {
      if (day.status === "completed") {
        const marker = findCompletionMarkerForDay(habit, day.date);
        if (marker) {
          await undoCompleteHabit(habit.id, marker);
        }
        return;
      }

      if (day.status === "skipped") {
        const skipTimestamp = findSkipTimestampForDay(habit, day.date);
        if (skipTimestamp) {
          const occurrences = (habit.occurrences ?? []).filter(
            occ => !(occ.status === "skipped" && occ.timestamp === skipTimestamp),
          );
          await updateHabit(habit.id, { occurrences });
        }
        return;
      }

      await completeWithUndoToast(backfillTimestampForDay(day.date));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleHourlySlot = async (slot: HabitHistorySlot) => {
    if (busyKey) {
      return;
    }

    setBusyKey(slot.start.toISOString());
    try {
      if (slot.status === "completed") {
        const marker = findCompletionMarkerForSlot(habit, slot.start, slot.end);
        if (marker) {
          await undoCompleteHabit(habit.id, marker);
        }
        return;
      }

      if (slot.status === "skipped") {
        const occurrences = (habit.occurrences ?? []).filter(occ => {
          if (occ.status !== "skipped") {
            return true;
          }

          const skippedAt = new Date(occ.timestamp);
          return !(skippedAt >= slot.start && skippedAt < slot.end);
        });
        await updateHabit(habit.id, { occurrences });
        return;
      }

      await completeWithUndoToast(slot.start);
    } finally {
      setBusyKey(null);
    }
  };

  return { toggleDay, toggleHourlySlot, busyKey };
}
