import { describe, expect, it } from "vitest";

import { parseFocusQuickAdd } from "./flowFocus";
import type { Task } from "../context/DataContext";

function task(id: string, title: string): Task {
  return {
    id,
    title,
    description: "",
    completed: false,
    completedAt: null,
    priority: "medium",
    dueDate: null,
    dueTime: null,
    tags: [],
    subtasks: [],
  };
}

const TASKS = [task("t1", "Review Q3 roadmap draft"), task("t2", "Pay rent")];

describe("parseFocusQuickAdd", () => {
  it("returns null for empty input", () => {
    expect(parseFocusQuickAdd("", TASKS)).toBeNull();
    expect(parseFocusQuickAdd("   ", TASKS)).toBeNull();
  });

  it("parses the handoff example", () => {
    expect(parseFocusQuickAdd("2h on roadmap review, 25/5", TASKS)).toEqual({
      totalMinutes: 120,
      focusMinutes: 25,
      breakMinutes: 5,
      // "roadmap review" does not literal-match "Review Q3 roadmap draft"
      taskIds: [],
    });
  });

  it("matches a task via 'on <text>'", () => {
    expect(parseFocusQuickAdd("90m on roadmap", TASKS)).toEqual({
      totalMinutes: 90,
      focusMinutes: 25,
      breakMinutes: 5,
      taskIds: ["t1"],
    });
  });

  it("defaults to one hour with 25/5 splits", () => {
    expect(parseFocusQuickAdd("deep work", TASKS)).toEqual({
      totalMinutes: 60,
      focusMinutes: 25,
      breakMinutes: 5,
      taskIds: [],
    });
  });

  it("clamps the focus length to the total", () => {
    expect(parseFocusQuickAdd("20m, 25/5", TASKS)).toMatchObject({
      totalMinutes: 20,
      focusMinutes: 20,
    });
  });
});
