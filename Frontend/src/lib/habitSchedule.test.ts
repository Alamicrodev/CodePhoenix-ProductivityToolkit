import { describe, expect, it } from "vitest";
import type { Habit } from "../context/DataContext";
import {
  buildHabitHistorySlots,
  canCompleteHabitNow,
  formatHabitNextOccurrence,
  isHabitCurrentlyActive,
  localDateKey,
} from "./habitSchedule";



function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    createdAt: "2026-07-01T00:00:00Z",
    title: "Drink water",
    description: "",
    frequency: "daily",
    activeDays: [],
    streak: 0,
    lastCompleted: null,
    completedDates: [],
    occurrences: [],
    ...overrides,
  };
}

describe("habitSchedule", () => {
  it("builds hourly slots from active hours instead of rolling from now", () => {
    const now = new Date("2026-07-09T18:00:00Z");
    const habit = makeHabit({
      frequency: "hourly",
      hourlyInterval: 3,
      activeHours: { start: "07:00", end: "22:00" },
      completedDates: ["2026-07-08T14:57:00Z"],
    });

    const slots = buildHabitHistorySlots(habit, now, 30);

    expect(slots.some(slot => slot.label.includes("02:57"))).toBe(false);
    expect(slots
      .filter(slot => slot.start.getHours() === 7)
      .every(slot => slot.label.includes("7:00 AM"))).toBe(true);

    const completedSlot = slots.find(slot => localDateKey(slot.start) === "2026-07-08" && slot.start.getHours() === 13
    );
    expect(completedSlot?.status).toBe("completed");

    // const completedSlot = slots.find(slot => slot.start.toISOString().startsWith("2026-07-08T13"));
    // expect(completedSlot?.status).toBe("completed");
  });

  it("skips inactive days for daily habits and keeps today pending", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const todayDay = now.getDay();
    const habit = makeHabit({
      frequency: "daily",
      activeDays: [todayDay, (todayDay + 2) % 7],
      createdAt: "2026-07-05T00:00:00Z",
    });

    const slots = buildHabitHistorySlots(habit, now, 30);

    expect(slots.every(slot => habit.activeDays!.includes(slot.start.getDay()))).toBe(true);
    expect(slots[slots.length - 1]?.status).toBe("pending");
  });

  it("treats completed weekly ranges as complete and exposes next availability", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const habit = makeHabit({
      frequency: "weekly",
      createdAt: "2026-06-01T00:00:00Z",
      completedDates: ["2026-07-09T09:00:00Z"],
    });

    const slots = buildHabitHistorySlots(habit, now, 30);

    expect(slots.some(slot => slot.status === "completed")).toBe(true);
    expect(isHabitCurrentlyActive(habit, now)).toBe(true);
    expect(canCompleteHabitNow(habit, now)).toBe(false);
    expect(formatHabitNextOccurrence(habit, now)).toContain("Next window:");
  });
});
