import { describe, expect, it } from "vitest";

import { parseQuickAdd } from "./quickAdd";

// Wednesday, July 29 2026.
const NOW = new Date(2026, 6, 29, 15, 30);

describe("parseQuickAdd", () => {
  it("defaults to medium priority, no due date, Schedule quadrant", () => {
    expect(parseQuickAdd("write the report", NOW)).toEqual({
      title: "Write the report",
      priority: "medium",
      dueDate: null,
      quadrant: "not-urgent-important",
    });
  });

  it("parses !high / !med / !low tokens case-insensitively", () => {
    expect(parseQuickAdd("ship it !high", NOW).priority).toBe("high");
    expect(parseQuickAdd("ship it !HIGH", NOW).priority).toBe("high");
    expect(parseQuickAdd("ship it !med", NOW).priority).toBe("medium");
    expect(parseQuickAdd("ship it !medium", NOW).priority).toBe("medium");
    expect(parseQuickAdd("ship it !low", NOW).priority).toBe("low");
  });

  it("maps priority to the matching quadrant", () => {
    expect(parseQuickAdd("a !high", NOW).quadrant).toBe("urgent-important");
    expect(parseQuickAdd("a !med", NOW).quadrant).toBe("not-urgent-important");
    expect(parseQuickAdd("a !low", NOW).quadrant).toBe("not-urgent-not-important");
  });

  it("parses today and tomorrow into local date keys", () => {
    expect(parseQuickAdd("pay rent today", NOW).dueDate).toBe("2026-07-29");
    expect(parseQuickAdd("pay rent tomorrow", NOW).dueDate).toBe("2026-07-30");
  });

  it("rolls tomorrow across month boundaries", () => {
    const endOfMonth = new Date(2026, 6, 31, 9, 0);
    expect(parseQuickAdd("invoice tomorrow", endOfMonth).dueDate).toBe("2026-08-01");
  });

  it("strips tokens from the title and collapses whitespace", () => {
    const parsed = parseQuickAdd("pay rent tomorrow !high", NOW);
    expect(parsed.title).toBe("Pay rent");
    expect(parsed.priority).toBe("high");
    expect(parsed.dueDate).toBe("2026-07-30");
  });

  it("capitalizes the first letter of the title", () => {
    expect(parseQuickAdd("buy milk", NOW).title).toBe("Buy milk");
  });

  it("does not treat mid-word matches as tokens", () => {
    // "todayish" is not a date token; "!lowest" is not a priority token
    expect(parseQuickAdd("todayish plans", NOW).dueDate).toBeNull();
    expect(parseQuickAdd("fix !lowest bar", NOW).priority).toBe("medium");
  });

  it("returns an empty title when input is only tokens", () => {
    expect(parseQuickAdd("!high today", NOW).title).toBe("");
  });
});
