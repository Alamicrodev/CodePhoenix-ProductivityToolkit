import { describe, expect, it } from "vitest";
import { Habit, Task } from "../context/DataContext";
import {
  agendaGroups,
  AiScheduleItem,
  blocksFromAiItems,
  buildPlanItems,
  computePlanStats,
  formatBlockDuration,
  formatMinutes,
  formatTimeRange,
  isInProgress,
  isPlanMap,
  newBlockStart,
  packBlocks,
  replanBlocks,
  ScheduleBlock,
} from "./schedulePlan";

const block = (overrides: Partial<ScheduleBlock>): ScheduleBlock => ({
  id: "b1",
  start: 540,
  dur: 30,
  kind: "task",
  title: "Block",
  done: false,
  priority: "medium",
  ...overrides,
});

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  title: "Task",
  description: "",
  completed: false,
  completedAt: null,
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

describe("packBlocks", () => {
  it("packs sequentially and rounds each cursor up to 5m", () => {
    const placed = packBlocks(
      [block({ id: "a", dur: 32 }), block({ id: "b", dur: 45 })],
      540,
    );
    expect(placed.map(b => b.start)).toEqual([540, 575]); // 540+32=572 → 575
  });

  it("inserts a 15m break after ≥120m of continuous work", () => {
    const placed = packBlocks(
      [
        block({ id: "a", dur: 60 }),
        block({ id: "b", dur: 60 }),
        block({ id: "c", dur: 30 }),
      ],
      540,
    );
    expect(placed.map(b => [b.kind, b.start])).toEqual([
      ["task", 540],
      ["task", 600],
      ["break", 660],
      ["task", 675],
    ]);
  });
});

describe("replanBlocks", () => {
  const day = "2026-07-31";

  it("keeps done and ended blocks in place and drops future breaks", () => {
    const blocks = [
      block({ id: "done-later", start: 900, dur: 30, done: true }),
      block({ id: "ended", start: 480, dur: 30 }),
      block({ id: "break", start: 700, dur: 15, kind: "break", title: "Break" }),
      block({ id: "future", start: 800, dur: 30 }),
    ];
    const result = replanBlocks(blocks, 600, day);
    const ids = result.map(b => b.id);
    expect(ids).toContain("done-later");
    expect(ids).toContain("ended");
    expect(ids).not.toContain("break");
    expect(result.find(b => b.id === "done-later")!.start).toBe(900);
    expect(result.find(b => b.id === "future")!.start).toBe(600);
  });

  it("packs after the in-progress block", () => {
    const blocks = [
      block({ id: "running", start: 590, dur: 40 }), // 9:50–10:30, in progress at 10:00
      block({ id: "next", start: 700, dur: 30 }),
    ];
    const result = replanBlocks(blocks, 600, day);
    expect(result.find(b => b.id === "running")!.start).toBe(590);
    expect(result.find(b => b.id === "next")!.start).toBe(630);
  });

  it("orders movables: overdue → due that day → other → habits, by priority", () => {
    const blocks = [
      block({ id: "habit", start: 800, dur: 30, kind: "habit", priority: undefined }),
      block({ id: "other-high", start: 810, dur: 30, priority: "high", dueDate: "2026-08-05" }),
      block({ id: "due-today", start: 820, dur: 30, priority: "low", dueDate: day }),
      block({ id: "overdue", start: 830, dur: 30, priority: "low", dueDate: "2026-07-20" }),
    ];
    const result = replanBlocks(blocks, 600, day).filter(b => b.kind !== "break");
    expect(result.map(b => b.id)).toEqual(["overdue", "due-today", "other-high", "habit"]);
  });
});

describe("newBlockStart", () => {
  it("starts after the last end + 10 rounded to :15", () => {
    expect(newBlockStart([block({ start: 600, dur: 35 })])).toBe(645);
  });

  it("caps the start at 5:15 PM", () => {
    expect(newBlockStart([block({ start: 1080, dur: 60 })])).toBe(1035);
  });
});

describe("buildPlanItems", () => {
  const day = "2026-07-31";

  it("leads with the planning ritual, then tiered tasks, then habits", () => {
    const items = buildPlanItems(
      [
        task({ id: "later", dueDate: "2026-08-04", priority: "high" }),
        task({ id: "overdue", dueDate: "2026-07-25", priority: "low" }),
        task({ id: "today", dueDate: day, priority: "medium" }),
      ],
      [habit({ id: "h1" })],
      day,
    );
    expect(items.map(i => i.kind)).toEqual(["planning", "task", "task", "task", "habit"]);
    expect(items.slice(1, 4).map(i => i.sourceId)).toEqual(["overdue", "today", "later"]);
  });

  it("skips completed, excluded, undated, and far-future tasks", () => {
    const items = buildPlanItems(
      [
        task({ id: "done", completed: true, dueDate: day }),
        task({ id: "excluded", dueDate: day }),
        task({ id: "undated" }),
        task({ id: "far", dueDate: "2026-09-20" }),
      ],
      [],
      day,
      { excludeTaskIds: new Set(["excluded"]) },
    );
    expect(items.filter(i => i.kind === "task")).toHaveLength(0);
  });

  it("skips habits already completed that day", () => {
    const items = buildPlanItems([], [habit({ completedDates: [day] })], day);
    expect(items.filter(i => i.kind === "habit")).toHaveLength(0);
  });

  it("sizes task blocks by priority", () => {
    const items = buildPlanItems(
      [
        task({ id: "hi", dueDate: day, priority: "high" }),
        task({ id: "lo", dueDate: day, priority: "low" }),
      ],
      [],
      day,
    );
    const durs = Object.fromEntries(
      items.filter(i => i.kind === "task").map(i => [i.sourceId, i.dur]),
    );
    expect(durs).toEqual({ hi: 60, lo: 30 });
  });
});

describe("blocksFromAiItems", () => {
  const item = (overrides: Partial<AiScheduleItem>): AiScheduleItem => ({
    time: "9:00 AM",
    type: "task",
    title: "Item",
    priority: "medium",
    duration: "30 min",
    ...overrides,
  });

  const DAY = "2026-07-31";

  it("keeps model clock times and sorts by start", () => {
    const blocks = blocksFromAiItems(
      [
        item({ time: "2:30 PM", duration: "1 hour" }),
        item({ time: "9:15 AM", duration: "45 min" }),
      ],
      [],
      [],
      600,
      DAY,
    );
    expect(blocks!.map(b => [b.start, b.dur])).toEqual([
      [555, 45],
      [870, 60],
    ]);
  });

  it("enriches from the linked task and habit", () => {
    const blocks = blocksFromAiItems(
      [
        item({ source_id: "t1", source_type: "task" }),
        item({ time: "10:00 AM", type: "habit", source_id: "h1", source_type: "habit" }),
      ],
      [task({ id: "t1", priority: "high", dueDate: "2026-07-30" })],
      [habit({ id: "h1", streak: 9 })],
      600,
      DAY,
    );
    expect(blocks![0]).toMatchObject({ priority: "high", dueDate: "2026-07-30", sourceId: "t1" });
    expect(blocks![1]).toMatchObject({ kind: "habit", streak: 9, sourceId: "h1" });
  });

  it("places pseudo-time items via the replan engine from the anchor", () => {
    // Heuristic-fallback shape: only system items carry clock times.
    const blocks = blocksFromAiItems(
      [
        item({ time: "9:00 AM", type: "planning", title: "Morning planning" }),
        item({ time: "Today", title: "Due today task", source_id: "t1", source_type: "task" }),
        item({ time: "Now", type: "habit", title: "Meditate", source_id: "h1", source_type: "habit" }),
        item({ time: "Thu, Jul 23", title: "Overdue task", source_id: "t2", source_type: "task" }),
      ],
      [
        task({ id: "t1", dueDate: DAY }),
        task({ id: "t2", dueDate: "2026-07-23" }),
      ],
      [habit({ id: "h1" })],
      900, // 3:00 PM
      DAY,
    );
    const ids = blocks!.map(b => [b.title, b.start]);
    // Ended system block keeps its 9:00 slot; the rest pack from 3:00 by tier.
    expect(ids).toContainEqual(["Morning planning", 540]);
    expect(ids).toContainEqual(["Overdue task", 900]);
    expect(ids).toContainEqual(["Due today task", 930]);
    expect(ids).toContainEqual(["Meditate", 960]);
  });

  it("skips untitled items and returns null when nothing is usable", () => {
    expect(blocksFromAiItems([item({ title: "" })], [], [], 600, DAY)).toBeNull();
    const blocks = blocksFromAiItems([item({ title: "" }), item({})], [], [], 600, DAY);
    expect(blocks).toHaveLength(1);
  });
});

describe("derivations", () => {
  it("groups agenda rows into morning/afternoon/evening, excluding breaks", () => {
    const groups = agendaGroups([
      block({ id: "m", start: 540 }),
      block({ id: "brk", start: 700, kind: "break" }),
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
      block({ id: "brk", dur: 45, kind: "break" }),
      block({ id: "short", dur: 30 }),
    ]);
    expect(stats).toEqual({ plannedMin: 240, focusMin: 150, doneCount: 1, totalCount: 4 });
  });

  it("detects the in-progress block only today", () => {
    const b = block({ start: 600, dur: 60 });
    expect(isInProgress(b, 630, true)).toBe(true);
    expect(isInProgress(b, 630, false)).toBe(false);
    expect(isInProgress({ ...b, done: true }, 630, true)).toBe(false);
    expect(isInProgress(b, 660, true)).toBe(false);
  });

  it("validates persisted plan maps", () => {
    expect(isPlanMap({})).toBe(true);
    expect(
      isPlanMap({
        "2026-07-31": { optimizedAt: "2026-07-31T09:12:00Z", blocks: [block({})] },
      }),
    ).toBe(true);
    expect(isPlanMap({ day: { optimizedAt: "x", blocks: [{ id: 1 }] } })).toBe(false);
    expect(isPlanMap(null)).toBe(false);
    expect(isPlanMap([])).toBe(false);
  });
});
