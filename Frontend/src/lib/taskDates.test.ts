import { describe, expect, it } from "vitest";

import {
  compareByDueDate,
  compareByPriority,
  daysUntilDue,
  DueSortable,
  isOverdue,
  matchesDueDateFilter,
} from "./taskDates";

// Wednesday, July 29 2026, mid-afternoon local time.
const NOW = new Date(2026, 6, 29, 15, 30);

function sortable(overrides: Partial<DueSortable>): DueSortable {
  return { dueDate: null, dueTime: null, priority: "medium", ...overrides };
}

describe("daysUntilDue", () => {
  it("treats the due date as local, not UTC", () => {
    // new Date("2026-07-29") would be UTC midnight and could land on the 28th
    // locally; parsing must anchor to local midnight so "today" is 0 days away.
    expect(daysUntilDue("2026-07-29", NOW)).toBe(0);
    expect(daysUntilDue("2026-07-30", NOW)).toBe(1);
    expect(daysUntilDue("2026-07-28", NOW)).toBe(-1);
  });
});

describe("isOverdue", () => {
  it("is false for tasks without a due date", () => {
    expect(isOverdue(null, NOW)).toBe(false);
  });

  it("is false on the due date itself and true the day after", () => {
    expect(isOverdue("2026-07-29", NOW)).toBe(false);
    expect(isOverdue("2026-07-28", NOW)).toBe(true);
  });
});

describe("matchesDueDateFilter", () => {
  it("matches everything for 'all'", () => {
    expect(matchesDueDateFilter(null, "all", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-01-01", "all", NOW)).toBe(true);
  });

  it("buckets overdue, today, and tomorrow", () => {
    expect(matchesDueDateFilter("2026-07-28", "overdue", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-07-29", "today", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-07-30", "tomorrow", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-07-29", "overdue", NOW)).toBe(false);
  });

  it("'thisWeek' runs from today through Sunday inclusive", () => {
    // NOW is a Wednesday; Sunday is Aug 2.
    expect(matchesDueDateFilter("2026-07-29", "thisWeek", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-08-02", "thisWeek", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-08-03", "thisWeek", NOW)).toBe(false);
    expect(matchesDueDateFilter("2026-07-28", "thisWeek", NOW)).toBe(false);
  });

  it("on a Sunday, 'thisWeek' covers only that day", () => {
    const sunday = new Date(2026, 7, 2, 10, 0);
    expect(matchesDueDateFilter("2026-08-02", "thisWeek", sunday)).toBe(true);
    expect(matchesDueDateFilter("2026-08-03", "thisWeek", sunday)).toBe(false);
    expect(matchesDueDateFilter("2026-08-03", "later", sunday)).toBe(true);
  });

  it("'later' means after this week and excludes undated tasks", () => {
    expect(matchesDueDateFilter("2026-08-03", "later", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-08-02", "later", NOW)).toBe(false);
    expect(matchesDueDateFilter(null, "later", NOW)).toBe(false);
  });

  it("'noDate' matches only tasks without a due date", () => {
    expect(matchesDueDateFilter(null, "noDate", NOW)).toBe(true);
    expect(matchesDueDateFilter("2026-08-03", "noDate", NOW)).toBe(false);
  });
});

describe("compareByDueDate", () => {
  it("orders by date, then time, then priority", () => {
    const items = [
      sortable({ dueDate: "2026-07-30", dueTime: "09:00", priority: "low" }),
      sortable({ dueDate: "2026-07-29", dueTime: "17:00", priority: "low" }),
      sortable({ dueDate: "2026-07-29", dueTime: "09:00", priority: "low" }),
      sortable({ dueDate: "2026-07-29", dueTime: null, priority: "high" }),
    ];
    const sorted = [...items].sort(compareByDueDate);
    expect(sorted.map(i => `${i.dueDate} ${i.dueTime}`)).toEqual([
      "2026-07-29 09:00",
      "2026-07-29 17:00",
      "2026-07-29 null",
      "2026-07-30 09:00",
    ]);
  });

  it("puts undated items last, ordered by priority", () => {
    const items = [
      sortable({ priority: "low" }),
      sortable({ dueDate: "2026-08-01", priority: "low" }),
      sortable({ priority: "high" }),
    ];
    const sorted = [...items].sort(compareByDueDate);
    expect(sorted[0].dueDate).toBe("2026-08-01");
    expect(sorted[1].priority).toBe("high");
    expect(sorted[2].priority).toBe("low");
  });

  it("is stable-safe when both items lack dates and times", () => {
    const a = sortable({ priority: "medium" });
    const b = sortable({ priority: "medium" });
    expect(compareByDueDate(a, b)).toBe(0);
  });
});

describe("compareByPriority", () => {
  it("orders by priority first, then due date", () => {
    const items = [
      sortable({ dueDate: "2026-07-29", priority: "low" }),
      sortable({ dueDate: "2026-08-01", priority: "high" }),
      sortable({ dueDate: "2026-07-30", priority: "high" }),
    ];
    const sorted = [...items].sort(compareByPriority);
    expect(sorted.map(i => `${i.priority} ${i.dueDate}`)).toEqual([
      "high 2026-07-30",
      "high 2026-08-01",
      "low 2026-07-29",
    ]);
  });
});
