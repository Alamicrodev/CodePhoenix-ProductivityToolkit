import { describe, expect, it } from "vitest";
import type { Habit } from "../context/DataContext";
import { localDateKey } from "./habitSchedule";
import {
  backfillTimestampForDay,
  buildCalendarMonth,
  buildDayStatuses,
  buildMonthlyHistory,
  buildScoreSeries,
  buildWeekdayFrequency,
  buildWeeklyHistory,
  findCompletionMarkerForDay,
  findSkipTimestampForDay,
  getBestStreaks,
  getCurrentScore,
  getHabitHistoryStart,
} from "./habitStats";

const SCORE_DECAY = 0.5 ** (1 / 13);

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    createdAt: "2026-06-01T00:00:00",
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

function dateKeys(from: string, count: number): string[] {
  const [year, month, day] = from.split("-").map(Number);
  const keys: string[] = [];
  const cursor = new Date(year, month - 1, day);

  for (let index = 0; index < count; index += 1) {
    keys.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

describe("buildScoreSeries", () => {
  it("reaches exactly 50% after 13 consecutive daily completions", () => {
    const habit = makeHabit({ completedDates: dateKeys("2026-06-01", 13) });
    const now = new Date(2026, 5, 13, 20, 0, 0);

    const points = buildScoreSeries(habit, now);

    expect(points).toHaveLength(13);
    expect(points[points.length - 1].score).toBeCloseTo(0.5, 10);
    expect(getCurrentScore(habit, now)).toBeCloseTo(0.5, 10);
  });

  it("decays on a missed day", () => {
    const habit = makeHabit({ completedDates: dateKeys("2026-06-01", 13) });
    const now = new Date(2026, 5, 15, 10, 0, 0); // June 14 fully missed

    expect(getCurrentScore(habit, now)).toBeCloseTo(0.5 * SCORE_DECAY, 10);
  });

  it("treats skipped days as neutral", () => {
    const habit = makeHabit({
      completedDates: dateKeys("2026-06-01", 13),
      occurrences: [{ timestamp: "2026-06-14", status: "skipped" }],
    });
    const now = new Date(2026, 5, 15, 10, 0, 0);

    expect(getCurrentScore(habit, now)).toBeCloseTo(0.5, 10);
  });

  it("ignores inactive days entirely", () => {
    // Active Mon-Fri only; June 1 2026 is a Monday.
    const habit = makeHabit({
      activeDays: [1, 2, 3, 4, 5],
      completedDates: [...dateKeys("2026-06-01", 5), ...dateKeys("2026-06-08", 5)],
    });
    const now = new Date(2026, 5, 12, 20, 0, 0); // Friday June 12

    const points = buildScoreSeries(habit, now);

    expect(points).toHaveLength(10);
    expect(points[points.length - 1].score).toBeCloseTo(1 - SCORE_DECAY ** 10, 10);
  });

  it("steps weekly habits once per week", () => {
    const habit = makeHabit({
      frequency: "weekly",
      createdAt: "2026-06-01T00:00:00",
      completedDates: ["2026-06-03", "2026-06-10", "2026-06-17"],
    });
    const now = new Date(2026, 5, 20, 12, 0, 0);

    const points = buildScoreSeries(habit, now);

    expect(points).toHaveLength(3);
    expect(points[points.length - 1].score).toBeCloseTo(1 - SCORE_DECAY ** 3, 10);
  });

  it("gives hourly habits fractional daily credit", () => {
    const habit = makeHabit({
      frequency: "hourly",
      hourlyInterval: 6,
      activeHours: { start: "06:00", end: "18:00" },
      createdAt: "2026-06-10T00:00:00",
      completedDates: ["2026-06-10T07:00:00"],
    });
    const now = new Date(2026, 5, 11, 5, 0, 0);

    const points = buildScoreSeries(habit, now);

    // June 10 has two 6h slots, one completed -> value 0.5
    expect(points).toHaveLength(1);
    expect(points[0].score).toBeCloseTo(0.5 * (1 - SCORE_DECAY), 10);
  });
});

describe("getBestStreaks", () => {
  it("orders streaks by length and reports bounds", () => {
    const habit = makeHabit({
      completedDates: [...dateKeys("2026-06-01", 3), ...dateKeys("2026-06-05", 6)],
    });
    const now = new Date(2026, 5, 11, 9, 0, 0); // June 11, today still pending

    const streaks = getBestStreaks(habit, now);

    expect(streaks).toHaveLength(2);
    expect(streaks[0].length).toBe(6);
    expect(localDateKey(streaks[0].start)).toBe("2026-06-05");
    expect(localDateKey(streaks[0].end)).toBe("2026-06-10");
    expect(streaks[1].length).toBe(3);
  });

  it("breaks streaks on skipped days like the backend", () => {
    const habit = makeHabit({
      completedDates: [...dateKeys("2026-06-01", 3), ...dateKeys("2026-06-05", 2)],
      occurrences: [{ timestamp: "2026-06-04", status: "skipped" }],
    });
    const now = new Date(2026, 5, 7, 9, 0, 0);

    const streaks = getBestStreaks(habit, now);

    expect(streaks.map(streak => streak.length)).toEqual([3, 2]);
  });

  it("lets streaks span inactive days", () => {
    // Active Mon-Fri; completions Fri June 5 and Mon June 8 bridge the weekend.
    const habit = makeHabit({
      activeDays: [1, 2, 3, 4, 5],
      completedDates: [...dateKeys("2026-06-01", 5), ...dateKeys("2026-06-08", 2)],
    });
    const now = new Date(2026, 5, 9, 20, 0, 0);

    const streaks = getBestStreaks(habit, now);

    expect(streaks[0].length).toBe(7);
  });

  it("counts weekly streaks in weeks", () => {
    const habit = makeHabit({
      frequency: "weekly",
      completedDates: ["2026-06-03", "2026-06-10"],
    });
    const now = new Date(2026, 5, 18, 12, 0, 0);

    const streaks = getBestStreaks(habit, now);

    expect(streaks[0].length).toBe(2);
  });
});

describe("buildDayStatuses", () => {
  it("classifies daily statuses including before-start and future", () => {
    const habit = makeHabit({
      createdAt: "2026-06-05T00:00:00",
      completedDates: ["2026-06-05"],
    });
    const now = new Date(2026, 5, 7, 12, 0, 0);

    const statuses = buildDayStatuses(habit, now, localDate("2026-06-03"), localDate("2026-06-08"));
    const byKey = Object.fromEntries(statuses.map(status => [status.key, status]));

    expect(byKey["2026-06-03"].status).toBe("before-start");
    expect(byKey["2026-06-03"].toggleable).toBe(false);
    expect(byKey["2026-06-05"].status).toBe("completed");
    expect(byKey["2026-06-06"].status).toBe("missed");
    expect(byKey["2026-06-06"].toggleable).toBe(true);
    expect(byKey["2026-06-07"].status).toBe("pending");
    expect(byKey["2026-06-07"].toggleable).toBe(true);
    expect(byKey["2026-06-08"].status).toBe("pending");
    expect(byKey["2026-06-08"].toggleable).toBe(false);
  });

  it("marks skipped daily days as toggleable", () => {
    const habit = makeHabit({
      occurrences: [{ timestamp: "2026-06-06", status: "skipped" }],
    });
    const now = new Date(2026, 5, 7, 12, 0, 0);

    const statuses = buildDayStatuses(habit, now, localDate("2026-06-06"), localDate("2026-06-06"));

    expect(statuses[0].status).toBe("skipped");
    expect(statuses[0].toggleable).toBe(true);
  });

  it("aggregates hourly days into partial completions", () => {
    const habit = makeHabit({
      frequency: "hourly",
      hourlyInterval: 3,
      activeHours: { start: "06:00", end: "18:00" },
      createdAt: "2026-06-01T00:00:00",
      completedDates: ["2026-06-10T07:00:00", "2026-06-10T13:00:00"],
    });
    const now = new Date(2026, 5, 11, 12, 0, 0);

    const statuses = buildDayStatuses(habit, now, localDate("2026-06-10"), localDate("2026-06-10"));

    expect(statuses[0].status).toBe("partial");
    expect(statuses[0].dueSlots).toBe(4);
    expect(statuses[0].completedSlots).toBe(2);
  });

  it("allows today's active hourly slot before it has elapsed", () => {
    const habit = makeHabit({
      frequency: "hourly",
      hourlyInterval: 3,
      activeHours: { start: "07:00", end: "22:00" },
      createdAt: "2026-08-04T00:00:00",
    });
    const now = new Date(2026, 7, 4, 7, 56, 0);

    const statuses = buildDayStatuses(habit, now, localDate("2026-08-04"), localDate("2026-08-04"));

    expect(statuses[0].status).toBe("pending");
    expect(statuses[0].dueSlots).toBe(0);
    expect(statuses[0].toggleable).toBe(true);
  });

  it("marks the weekly completion day and dims the rest of a satisfied week", () => {
    const habit = makeHabit({
      frequency: "weekly",
      completedDates: ["2026-06-03"],
    });
    const now = new Date(2026, 5, 10, 12, 0, 0);

    const statuses = buildDayStatuses(habit, now, localDate("2026-05-31"), localDate("2026-06-06"));
    const byKey = Object.fromEntries(statuses.map(status => [status.key, status]));

    expect(byKey["2026-06-03"].status).toBe("completed");
    expect(byKey["2026-06-02"].status).toBe("inactive");
    expect(byKey["2026-06-05"].status).toBe("inactive");
  });

  it("marks all days of an elapsed unsatisfied week as missed", () => {
    const habit = makeHabit({ frequency: "weekly", createdAt: "2026-05-25T00:00:00" });
    const now = new Date(2026, 5, 10, 12, 0, 0);

    const statuses = buildDayStatuses(habit, now, localDate("2026-05-31"), localDate("2026-06-06"));

    expect(statuses.every(status => status.status === "missed")).toBe(true);
  });
});

describe("buildCalendarMonth", () => {
  it("pads the grid to full Sunday-first weeks", () => {
    const habit = makeHabit();
    const now = new Date(2026, 6, 15, 12, 0, 0);

    const calendar = buildCalendarMonth(habit, now, 2026, 5); // June 2026 starts on a Monday

    expect(calendar.weeks).toHaveLength(5);
    expect(calendar.weeks[0][0]).toBeNull();
    expect(calendar.weeks[0][1]?.key).toBe("2026-06-01");
    expect(calendar.weeks[4][6]).toBeNull();
    expect(calendar.weeks.flat().filter(Boolean)).toHaveLength(30);
  });
});

describe("history aggregations", () => {
  it("counts completions per week", () => {
    const habit = makeHabit({
      completedDates: [...dateKeys("2026-06-01", 3), ...dateKeys("2026-06-08", 5)],
    });
    const now = new Date(2026, 5, 12, 12, 0, 0);

    const weeks = buildWeeklyHistory(habit, now, 3);

    expect(weeks).toHaveLength(3);
    expect(weeks[1].completed).toBe(3);
    expect(weeks[2].completed).toBe(5);
  });

  it("counts completions per month", () => {
    const habit = makeHabit({
      completedDates: [...dateKeys("2026-05-28", 4), ...dateKeys("2026-06-01", 2)],
    });
    const now = new Date(2026, 5, 12, 12, 0, 0);

    const months = buildMonthlyHistory(habit, now, 2);

    expect(months[0].label).toBe("May");
    expect(months[0].completed).toBe(4);
    expect(months[1].completed).toBe(2);
  });

  it("computes weekday frequency Sun..Sat", () => {
    const habit = makeHabit({
      // June 1 2026 = Monday, June 7 = Sunday
      completedDates: ["2026-06-01", "2026-06-08", "2026-06-07"],
    });

    const counts = buildWeekdayFrequency(habit);

    expect(counts[1]).toBe(2);
    expect(counts[0]).toBe(1);
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(3);
  });
});

describe("backfill helpers", () => {
  it("produces timestamps whose UTC date matches the local day key", () => {
    for (const value of ["2026-06-01", "2026-12-31", "2026-01-01", "2026-02-28"]) {
      const day = localDate(value);
      const timestamp = backfillTimestampForDay(day);

      expect(timestamp.toISOString().slice(0, 10)).toBe(localDateKey(day));
    }
  });

  it("finds completion markers stored as plain date keys or full ISO strings", () => {
    const habit = makeHabit({
      completedDates: ["2026-06-05", new Date(2026, 5, 6, 17, 30).toISOString()],
    });

    expect(findCompletionMarkerForDay(habit, localDate("2026-06-05"))).toBe("2026-06-05");
    expect(findCompletionMarkerForDay(habit, localDate("2026-06-06"))).toBe(habit.completedDates[1]);
    expect(findCompletionMarkerForDay(habit, localDate("2026-06-07"))).toBeNull();
  });

  it("finds skip timestamps by local day", () => {
    const habit = makeHabit({
      occurrences: [{ timestamp: "2026-06-06", status: "skipped" }],
    });

    expect(findSkipTimestampForDay(habit, localDate("2026-06-06"))).toBe("2026-06-06");
    expect(findSkipTimestampForDay(habit, localDate("2026-06-07"))).toBeNull();
  });
});

describe("getHabitHistoryStart", () => {
  it("uses the earliest of createdAt and recorded history", () => {
    const habit = makeHabit({
      createdAt: "2026-06-05T00:00:00",
      completedDates: ["2026-06-02"],
    });
    const now = new Date(2026, 5, 10, 12, 0, 0);

    expect(localDateKey(getHabitHistoryStart(habit, now))).toBe("2026-06-02");
  });

  it("falls back to 90 days back with no history", () => {
    const habit = makeHabit({ createdAt: undefined });
    const now = new Date(2026, 5, 10, 12, 0, 0);

    expect(localDateKey(getHabitHistoryStart(habit, now))).toBe("2026-03-12");
  });
});
