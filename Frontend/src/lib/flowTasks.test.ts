import { describe, expect, it } from "vitest";

import {
  autoCategorizeQuadrant,
  effectiveQuadrant,
  formatDoneAt,
  formatDueLabel,
  parseQuickAdd,
  sortTasks,
  userInitials,
} from "./flowTasks";
import type { Task } from "../context/DataContext";

const NOW = new Date(2026, 6, 22); // Jul 22, 2026 (local)

describe("parseQuickAdd", () => {
  it("returns null for empty or token-only input", () => {
    expect(parseQuickAdd("", NOW)).toBeNull();
    expect(parseQuickAdd("   ", NOW)).toBeNull();
    expect(parseQuickAdd("!high today", NOW)).toBeNull();
  });

  it("defaults to medium priority and the Schedule quadrant", () => {
    expect(parseQuickAdd("write the report", NOW)).toEqual({
      title: "Write the report",
      priority: "medium",
      dueDate: null,
      quadrant: "not-urgent-important",
    });
  });

  it("parses !high with tomorrow and strips the tokens", () => {
    expect(parseQuickAdd("pay rent tomorrow !high", NOW)).toEqual({
      title: "Pay rent",
      priority: "high",
      dueDate: "2026-07-23",
      quadrant: "urgent-important",
    });
  });

  it("parses !med and !low variants case-insensitively", () => {
    expect(parseQuickAdd("tidy desk !LOW", NOW)).toMatchObject({
      priority: "low",
      quadrant: "not-urgent-not-important",
    });
    expect(parseQuickAdd("review draft !med", NOW)).toMatchObject({
      title: "Review draft",
      priority: "medium",
    });
  });

  it("parses today into the current date", () => {
    expect(parseQuickAdd("standup notes today", NOW)).toMatchObject({
      title: "Standup notes",
      dueDate: "2026-07-22",
    });
  });

  it("does not treat words containing tokens as tokens", () => {
    expect(parseQuickAdd("plan todays agenda", NOW)).toMatchObject({
      title: "Plan todays agenda",
      dueDate: null,
    });
  });
});

describe("formatDueLabel", () => {
  it("labels today and tomorrow, flagging today as urgent", () => {
    expect(formatDueLabel("2026-07-22", NOW)).toEqual({ label: "Today", urgent: true });
    expect(formatDueLabel("2026-07-23", NOW)).toEqual({ label: "Tomorrow", urgent: false });
  });

  it("formats other dates as short month/day and flags overdue", () => {
    expect(formatDueLabel("2026-07-30", NOW)).toEqual({ label: "Jul 30", urgent: false });
    expect(formatDueLabel("2026-07-20", NOW)).toEqual({ label: "Jul 20", urgent: true });
  });

  it("returns null without a due date", () => {
    expect(formatDueLabel(null, NOW)).toBeNull();
  });
});

describe("formatDoneAt", () => {
  it("formats a completion timestamp", () => {
    const stamp = new Date(2026, 6, 21, 18, 20).toISOString();
    expect(formatDoneAt(stamp)).toBe("Jul 21, 6:20 PM");
  });

  it("returns empty string for missing or invalid input", () => {
    expect(formatDoneAt(null)).toBe("");
    expect(formatDoneAt("not-a-date")).toBe("");
  });
});

describe("effectiveQuadrant", () => {
  it("prefers the stored quadrant", () => {
    expect(effectiveQuadrant({ quadrant: "urgent-not-important", priority: "low" })).toBe(
      "urgent-not-important",
    );
  });

  it("falls back to the priority mapping", () => {
    expect(effectiveQuadrant({ quadrant: undefined, priority: "high" })).toBe("urgent-important");
    expect(effectiveQuadrant({ quadrant: undefined, priority: "medium" })).toBe("not-urgent-important");
    expect(effectiveQuadrant({ quadrant: undefined, priority: "low" })).toBe(
      "not-urgent-not-important",
    );
  });
});

describe("autoCategorizeQuadrant", () => {
  it("uses due-within-2-days as urgency and high/medium as importance", () => {
    expect(autoCategorizeQuadrant({ dueDate: "2026-07-23", priority: "high" }, NOW)).toBe(
      "urgent-important",
    );
    expect(autoCategorizeQuadrant({ dueDate: null, priority: "medium" }, NOW)).toBe(
      "not-urgent-important",
    );
    expect(autoCategorizeQuadrant({ dueDate: "2026-07-22", priority: "low" }, NOW)).toBe(
      "urgent-not-important",
    );
    expect(autoCategorizeQuadrant({ dueDate: null, priority: "low" }, NOW)).toBe(
      "not-urgent-not-important",
    );
  });
});

function task(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: "t",
    description: "",
    completed: false,
    completedAt: null,
    priority: "medium",
    dueDate: null,
    dueTime: null,
    tags: [],
    subtasks: [],
    ...overrides,
  };
}

describe("sortTasks", () => {
  it("sorts by due date with undated tasks last, breaking ties by priority", () => {
    const sorted = sortTasks(
      [
        task({ id: "none", dueDate: null }),
        task({ id: "late", dueDate: "2026-08-01" }),
        task({ id: "soon-low", dueDate: "2026-07-23", priority: "low" }),
        task({ id: "soon-high", dueDate: "2026-07-23", priority: "high" }),
      ],
      "dueDate",
    );
    expect(sorted.map(t => t.id)).toEqual(["soon-high", "soon-low", "late", "none"]);
  });

  it("sorts by priority first when requested", () => {
    const sorted = sortTasks(
      [
        task({ id: "low", priority: "low", dueDate: "2026-07-22" }),
        task({ id: "high", priority: "high" }),
        task({ id: "med", priority: "medium" }),
      ],
      "priority",
    );
    expect(sorted.map(t => t.id)).toEqual(["high", "med", "low"]);
  });
});

describe("userInitials", () => {
  it("takes first and last name initials", () => {
    expect(userInitials("Sharad Bhamidipati")).toBe("SB");
    expect(userInitials("Plato")).toBe("P");
    expect(userInitials(undefined)).toBe("?");
  });
});
