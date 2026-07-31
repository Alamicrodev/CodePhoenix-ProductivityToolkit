import { describe, expect, it } from "vitest";
import { Habit, Task } from "../context/DataContext";
import {
  agendaGroups,
  computePlanStats,
  deriveDayBlocks,
  formatBlockDuration,
  formatMinutes,
  formatTimeRange,
  isInProgress,
  layoutTimedBlocks,
  ScheduleBlock,
  UNTIMED,
} from "./schedulePlan";

const DAY = "2026-07-31"; // a Friday

const block = (overrides: Partial<ScheduleBlock>): ScheduleBlock => ({
  id: "b1",
  start: 540,
  dur: 30,
  kind: "task",
  title: "Block",
  done: false,
  priority: "medium",
  sourceId: "t1",
  ...overrides,
});

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  title: "Task",
  description: "",
  completed: false,
  completedAt: null,
  durationMinutes: null,
  priority: "medium",
  dueDate: null,
  dueTime: null,
  subtasks: [],
  tags: [],
  ...overrides,
});

const habit = (overrides: Partial<Habit>): Habit => ({
  id: "h1",
  title: "Habit",
  description: "",
  frequency: "daily",
  streak: 4,
  lastCompleted: null,
  completedDates: [],
  ...overrides,
});

describe("formatting", () => {
  it("formats minutes with and without period", () => {
    expect(formatMinutes(540)).toBe("9:00");
    expect(formatMinutes(555, true)).toBe("9:15 AM");
    expect(formatMinutes(750, true)).toBe("12:30 PM");
    expect(formatMinutes(0, true)).toBe("12:00 AM");
  });

  it("formats durations compactly", () => {
    expect(formatBlockDuration(30)).toBe("30m");
    expect(formatBlockDuration(60)).toBe("1h");
    expect(formatBlockDuration(90)).toBe("1h 30m");
  });

  it("formats ranges with the period on the end only", () => {
    expect(formatTimeRange(570, 630)).toBe("9:30 – 10:30 AM");
  });
});

describe("deriveDayBlocks", () => {
  it("includes only tasks due that day, timed at their due time", () => {
    const { timed, untimed } = deriveDayBlocks(
      [
        task({ id: "timed", dueDate: DAY, dueTime: "14:30" }),
        task({ id: "untimed", dueDate: DAY }),
        task({ id: "other-day", dueDate: "2026-08-01", dueTime: "09:00" }),
        task({ id: "no-date" }),
      ],
      [],
      DAY,
    );
    expect(timed.map(b => [b.sourceId, b.start])).toEqual([["timed", 870]]);
    expect(untimed.map(b => b.sourceId)).toEqual(["untimed"]);
  });

  it("estimates task duration from priority when no estimate is set", () => {
    const { timed } = deriveDayBlocks(
      [
        task({ id: "hi", dueDate: DAY, dueTime: "09:00", priority: "high" }),
        task({ id: "lo", dueDate: DAY, dueTime: "12:00", priority: "low" }),
      ],
      [],
      DAY,
    );
    expect(timed.map(b => b.dur)).toEqual([60, 30]);
  });

  it("uses the task's own duration when set", () => {
    const { timed, untimed } = deriveDayBlocks(
      [
        task({ id: "est", dueDate: DAY, dueTime: "09:00", priority: "low", durationMinutes: 120 }),
        task({ id: "untimed-est", dueDate: DAY, durationMinutes: 15 }),
      ],
      [],
      DAY,
    );
    expect(timed[0].dur).toBe(120);
    expect(untimed[0].dur).toBe(15);
  });

  it("keeps completed tasks with done state", () => {
    const { untimed } = deriveDayBlocks(
      [task({ dueDate: DAY, completed: true })],
      [],
      DAY,
    );
    expect(untimed[0].done).toBe(true);
  });

  it("places habits at their active-hours start and honors active days", () => {
    const { timed, untimed } = deriveDayBlocks(
      [],
      [
        habit({ id: "morning", activeHours: { start: "07:30", end: "09:00" } }),
        habit({ id: "anytime" }),
        habit({ id: "weekend-only", activeDays: [0, 6] }), // Fri excluded
        habit({ id: "hourly", frequency: "hourly" }),
      ],
      DAY,
    );
    expect(timed.map(b => [b.sourceId, b.start])).toEqual([["morning", 450]]);
    expect(untimed.map(b => b.sourceId)).toEqual(["anytime"]);
  });

  it("derives habit done from that day's completion", () => {
    const { untimed } = deriveDayBlocks([], [habit({ completedDates: [DAY] })], DAY);
    expect(untimed[0].done).toBe(true);
  });

  it("orders untimed items tasks-first by priority", () => {
    const { untimed } = deriveDayBlocks(
      [
        task({ id: "lo", dueDate: DAY, priority: "low" }),
        task({ id: "hi", dueDate: DAY, priority: "high" }),
      ],
      [habit({ id: "h" })],
      DAY,
    );
    expect(untimed.map(b => b.sourceId)).toEqual(["hi", "lo", "h"]);
  });
});

describe("layoutTimedBlocks", () => {
  it("keeps non-overlapping blocks in place", () => {
    const laid = layoutTimedBlocks([
      block({ id: "b", start: 700 }),
      block({ id: "a", start: 540 }),
    ]);
    expect(laid.map(b => [b.id, b.start])).toEqual([
      ["a", 540],
      ["b", 700],
    ]);
  });

  it("cascades simultaneous and overlapping blocks", () => {
    const laid = layoutTimedBlocks([
      block({ id: "a", start: 540, dur: 60 }),
      block({ id: "b", start: 540, dur: 30 }),
      block({ id: "c", start: 615, dur: 30 }),
    ]);
    // a and b both 9:00 — b pushes to 10:00; c (10:15) fits after b's new end? b ends 10:30 → c pushes to 10:30.
    expect(laid.map(b => [b.id, b.start])).toEqual([
      ["a", 540],
      ["b", 600],
      ["c", 630],
    ]);
  });
});

describe("drag scheduling", () => {
  it("snaps to the 15m grid and clamps to the visible day", async () => {
    const { snapToSlot } = await import("./schedulePlan");
    expect(snapToSlot(547)).toBe(540); // 9:07 → 9:00
    expect(snapToSlot(553)).toBe(555); // 9:13 → 9:15
    expect(snapToSlot(100)).toBe(480); // before 8:00 → 8:00
    expect(snapToSlot(2000)).toBe(1065); // after 6:00 PM → 5:45 PM
  });

  it("snaps resized durations to 15m between 15m and 12h", async () => {
    const { snapDuration } = await import("./schedulePlan");
    expect(snapDuration(50)).toBe(45);
    expect(snapDuration(52.5)).toBe(60);
    expect(snapDuration(7)).toBe(15); // floor
    expect(snapDuration(-30)).toBe(15);
    expect(snapDuration(1000)).toBe(720); // ceiling
  });

  it("formats minutes as workspace clock times", async () => {
    const { minutesToClock } = await import("./schedulePlan");
    expect(minutesToClock(555)).toBe("09:15");
    expect(minutesToClock(990)).toBe("16:30");
  });

  it("shifts a habit window preserving its length", async () => {
    const { shiftWindow } = await import("./schedulePlan");
    expect(shiftWindow({ start: "08:15", end: "09:00" }, 600)).toEqual({
      start: "10:00",
      end: "10:45",
    });
    expect(shiftWindow(undefined, 540)).toEqual({ start: "09:00", end: "09:30" });
  });

  it("maps grid Y offsets to minutes", async () => {
    const { minutesFromGridY, GRID_PAD, HOUR_PX, DAY_START } = await import("./schedulePlan");
    expect(minutesFromGridY(GRID_PAD)).toBe(DAY_START);
    expect(minutesFromGridY(GRID_PAD + HOUR_PX)).toBe(DAY_START + 60);
  });
});

describe("derivations", () => {
  it("groups agenda rows into morning/afternoon/evening", () => {
    const groups = agendaGroups([
      block({ id: "m", start: 540 }),
      block({ id: "a", start: 800 }),
      block({ id: "e", start: 1030 }),
    ]);
    expect(groups.map(g => [g.name, g.rows.length])).toEqual([
      ["Morning", 1],
      ["Afternoon", 1],
      ["Evening", 1],
    ]);
  });

  it("computes planned/focus/done stats", () => {
    const stats = computePlanStats([
      block({ id: "a", dur: 60, done: true }),
      block({ id: "b", dur: 90 }),
      block({ id: "hab", dur: 60, kind: "habit" }),
      block({ id: "short", dur: 30, start: UNTIMED }),
    ]);
    expect(stats).toEqual({ plannedMin: 240, focusMin: 150, doneCount: 1, totalCount: 4 });
  });

  it("detects the in-progress block only today", () => {
    const b = block({ start: 600, dur: 60 });
    expect(isInProgress(b, 630, true)).toBe(true);
    expect(isInProgress(b, 630, false)).toBe(false);
    expect(isInProgress({ ...b, done: true }, 630, true)).toBe(false);
    expect(isInProgress({ ...b, start: UNTIMED }, 630, true)).toBe(false);
    expect(isInProgress(b, 660, true)).toBe(false);
  });
});
