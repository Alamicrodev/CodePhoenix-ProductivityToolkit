import { describe, expect, it } from "vitest";

import {
  describeHabitListMeta,
  describeHabitSchedule,
  formatActiveDays,
  hourlySlotsPerDay,
  type HabitScheduleDraft,
} from "./habitScheduleSummary";
import type { Habit } from "../context/DataContext";

const base: HabitScheduleDraft = {
  frequency: "daily",
  hourlyInterval: 1,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  activeHours: null,
};

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    createdAt: "2026-08-04T00:00:00",
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

describe("formatActiveDays", () => {
  it("names the whole week rather than listing it", () => {
    expect(formatActiveDays([0, 1, 2, 3, 4, 5, 6])).toBe("every day");
  });

  it("treats the wire's empty array as every day", () => {
    // [] means "every day" in both schedule engines — the summary must agree.
    expect(formatActiveDays([])).toBe("every day");
  });

  it("recognises weekdays and weekends", () => {
    expect(formatActiveDays([1, 2, 3, 4, 5])).toBe("weekdays");
    expect(formatActiveDays([0, 6])).toBe("weekends");
  });

  it("lists anything else in week order", () => {
    expect(formatActiveDays([5, 1, 3])).toBe("Mon, Wed, Fri");
  });
});

describe("hourlySlotsPerDay", () => {
  it("spans the whole day when there is no window", () => {
    expect(hourlySlotsPerDay(1, null)).toBe(24);
    expect(hourlySlotsPerDay(2, null)).toBe(12);
  });

  it("divides the window by the interval", () => {
    expect(hourlySlotsPerDay(2, { start: "07:00", end: "22:00" })).toBe(8);
    expect(hourlySlotsPerDay(4, { start: "09:00", end: "17:00" })).toBe(2);
  });

  it("reads a zero or inverted window as all day, like the schedule engine", () => {
    expect(hourlySlotsPerDay(1, { start: "09:00", end: "09:00" })).toBe(24);
    expect(hourlySlotsPerDay(1, { start: "22:00", end: "07:00" })).toBe(24);
  });

  it("never promises fewer than one check-in", () => {
    expect(hourlySlotsPerDay(12, { start: "09:00", end: "10:00" })).toBe(1);
  });
});

describe("describeHabitSchedule", () => {
  it("describes an hourly habit with its window and slot count", () => {
    expect(
      describeHabitSchedule({
        ...base,
        frequency: "hourly",
        hourlyInterval: 2,
        activeHours: { start: "07:00", end: "22:00" },
      }),
    ).toBe("Every 2h · every day · 7:00 AM–10:00 PM · ~8 check-ins a day");
  });

  it("says all day when an hourly habit has no window", () => {
    expect(describeHabitSchedule({ ...base, frequency: "hourly" })).toBe(
      "Every 1h · every day · all day · ~24 check-ins a day",
    );
  });

  it("singularises a lone check-in", () => {
    expect(
      describeHabitSchedule({
        ...base,
        frequency: "hourly",
        hourlyInterval: 12,
        activeHours: { start: "09:00", end: "10:00" },
      }),
    ).toContain("~1 check-in a day");
  });

  it("tells a daily habit whether its time reaches the schedule timeline", () => {
    expect(describeHabitSchedule({ ...base, activeDays: [1, 2, 3, 4, 5] })).toBe(
      "Once a day · weekdays · not on the schedule timeline",
    );
    expect(
      describeHabitSchedule({
        ...base,
        activeDays: [1, 2, 3, 4, 5],
        activeHours: { start: "07:00", end: "07:00" },
      }),
    ).toBe("Once a day · weekdays · 7:00 AM on the schedule");
  });

  it("says out loud that a restricted weekly habit can only be checked in on those days", () => {
    expect(describeHabitSchedule({ ...base, frequency: "weekly" })).toBe(
      "Once a week · check in any day",
    );
    expect(describeHabitSchedule({ ...base, frequency: "weekly", activeDays: [1] })).toBe(
      "Once a week · Mon only",
    );
  });
});

describe("describeHabitListMeta", () => {
  it("includes strength, frequency, active days, and active hours", () => {
    expect(
      describeHabitListMeta(
        makeHabit({
          frequency: "hourly",
          hourlyInterval: 3,
          activeDays: [1, 2, 3, 4, 5],
          activeHours: { start: "07:00", end: "22:00" },
        }),
      ),
    ).toBe("Every 3 hours (7:00 AM-10:00 PM) | weekdays");
  });

  it("singularises hourly habits that repeat every hour", () => {
    expect(describeHabitListMeta(makeHabit({ frequency: "hourly", hourlyInterval: 1 }))).toBe(
      "Every hour",
    );
  });

  it("does not repeat days for weekly habits", () => {
    expect(describeHabitListMeta(makeHabit({ frequency: "weekly", activeDays: [0, 6] }))).toBe(
      "Weekly",
    );
  });

  it("shows daily only when every day is active", () => {
    expect(describeHabitListMeta(makeHabit({ frequency: "daily", activeDays: [] }))).toBe(
      "Daily",
    );
  });

  it("uses active days instead of daily for restricted daily habits", () => {
    expect(describeHabitListMeta(makeHabit({ frequency: "daily", activeDays: [1, 3, 5] }))).toBe(
      "Mon, Wed, Fri",
    );
  });
});
