import { describe, expect, it } from "vitest";

import { habitFrequencyLabel, parseHabitQuickAdd, trailingWeekLabels } from "./flowHabits";
import type { Habit } from "../context/DataContext";

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: "h1",
    title: "t",
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

describe("parseHabitQuickAdd", () => {
  it("returns null for empty or token-only input", () => {
    expect(parseHabitQuickAdd("")).toBeNull();
    expect(parseHabitQuickAdd("10m every weekday")).toBeNull();
  });

  it("parses the handoff example", () => {
    expect(parseHabitQuickAdd("meditate 10m every weekday")).toEqual({
      title: "Meditate",
      description: "10m",
      frequency: "daily",
      activeDays: [1, 2, 3, 4, 5],
    });
  });

  it("defaults to daily on all days", () => {
    expect(parseHabitQuickAdd("read 20 pages")).toEqual({
      title: "Read 20 pages",
      description: "",
      frequency: "daily",
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    });
  });

  it("parses day lists and weekly", () => {
    expect(parseHabitQuickAdd("gym every mon/wed/fri")).toMatchObject({
      title: "Gym",
      activeDays: [1, 3, 5],
    });
    expect(parseHabitQuickAdd("meal prep weekly")).toMatchObject({
      title: "Meal prep",
      frequency: "weekly",
    });
  });
});

describe("habitFrequencyLabel", () => {
  it("labels daily, weekdays, day lists, weekly, and hourly", () => {
    expect(habitFrequencyLabel(habit({}))).toBe("Daily");
    expect(habitFrequencyLabel(habit({ activeDays: [1, 2, 3, 4, 5] }))).toBe("Weekdays");
    expect(habitFrequencyLabel(habit({ activeDays: [1, 3, 5] }))).toBe("Mon / Wed / Fri");
    expect(habitFrequencyLabel(habit({ frequency: "weekly" }))).toBe("Weekly");
    expect(habitFrequencyLabel(habit({ frequency: "hourly", hourlyInterval: 2 }))).toBe("Every 2h");
  });

  it("appends a duration-style description", () => {
    expect(habitFrequencyLabel(habit({ description: "10m" }))).toBe("Daily · 10m");
    expect(habitFrequencyLabel(habit({ description: "long prose" }))).toBe("Daily");
  });
});

describe("trailingWeekLabels", () => {
  it("returns 7 labels ending with today", () => {
    const labels = trailingWeekLabels(new Date(2026, 6, 22)); // Wednesday
    expect(labels).toHaveLength(7);
    expect(labels[6]).toEqual({ label: "We", isToday: true });
    expect(labels[0]).toEqual({ label: "Th", isToday: false });
  });
});
