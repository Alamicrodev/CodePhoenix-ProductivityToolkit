import { describe, expect, it } from "vitest";

import { parseDateFieldInput, parseNaturalDate } from "./naturalDate";

// Monday 3 August 2026, midday.
const NOW = new Date(2026, 7, 3, 12, 0, 0);

const dateOf = (input: string) => parseDateFieldInput(input, NOW)?.date ?? null;

describe("parseDateFieldInput", () => {
  it("reads the everyday words", () => {
    expect(dateOf("today")).toBe("2026-08-03");
    expect(dateOf("tomorrow")).toBe("2026-08-04");
    expect(dateOf("next week")).toBe("2026-08-10");
  });

  it("rolls a weekday forward, never backward", () => {
    // Friday is later this week.
    expect(dateOf("friday")).toBe("2026-08-07");
    expect(dateOf("next friday")).toBe("2026-08-14");
    // Naming today's own weekday resolves to today, not a week out. Ambiguous
    // either way, and this is chrono's ruling — pinned so it cannot drift
    // silently on an upgrade.
    expect(dateOf("monday")).toBe("2026-08-03");
  });

  it("reads month-and-day in either order, rolling past dates to next year", () => {
    expect(dateOf("aug 15")).toBe("2026-08-15");
    expect(dateOf("15 august")).toBe("2026-08-15");
    expect(dateOf("august 15 2027")).toBe("2027-08-15");
    // Already gone by in 2026.
    expect(dateOf("jan 5")).toBe("2027-01-05");
  });

  it("reads relative spans and ISO", () => {
    expect(dateOf("in 2 weeks")).toBe("2026-08-17");
    expect(dateOf("in 3 days")).toBe("2026-08-06");
    expect(dateOf("2026-12-25")).toBe("2026-12-25");
  });

  it("carries a time through when the text names one", () => {
    const result = parseDateFieldInput("friday at 3pm", NOW);
    expect(result?.date).toBe("2026-08-07");
    expect(result?.time).toBe("15:00");
  });

  it("does not invent a time the text never gave", () => {
    // chrono implies midday internally; reading that would silently set 12:00.
    expect(parseDateFieldInput("friday", NOW)?.time).toBeNull();
    expect(parseDateFieldInput("aug 15", NOW)?.time).toBeNull();
  });

  it("rejects anything that is not entirely a date", () => {
    expect(dateOf("buy milk")).toBeNull();
    expect(dateOf("buy milk friday")).toBeNull();
    // chrono resolves this to a month from today while consuming only
    // "the month" — a wrong answer the leftover-text guard catches.
    expect(dateOf("end of the month")).toBeNull();
  });

  it("rejects a bare clock time, which belongs to the Time chip", () => {
    expect(dateOf("9:30pm")).toBeNull();
    expect(dateOf("3pm")).toBeNull();
  });

  it("returns null for an empty or partial draft", () => {
    expect(dateOf("")).toBeNull();
    expect(dateOf("   ")).toBeNull();
    expect(dateOf("frid")).toBeNull();
  });

  it("resolves a slash date US-style, matching the app's en-US formatting", () => {
    expect(dateOf("8/15")).toBe("2026-08-15");
  });
});

describe("parseNaturalDate", () => {
  it("finds a date inside a longer sentence and reports what it consumed", () => {
    const result = parseNaturalDate("pay rent tomorrow", NOW);
    expect(result?.date).toBe("2026-08-04");
    expect(result?.text).toBe("tomorrow");
    expect(result?.index).toBe(9);
    expect(result?.hasDate).toBe(true);
  });

  it("carries a bare time, flagged as having no date of its own", () => {
    // 9:30am has already gone by at the midday reference, so forwardDate
    // moves it to tomorrow — the same rule that stops "friday" landing in
    // the past. hasDate stays false: the text named a time, not a day.
    const past = parseNaturalDate("standup at 9:30am", NOW);
    expect(past?.date).toBe("2026-08-04");
    expect(past?.time).toBe("09:30");
    expect(past?.hasDate).toBe(false);

    // Still to come today, so it stays today.
    const later = parseNaturalDate("standup at 3pm", NOW);
    expect(later?.date).toBe("2026-08-03");
    expect(later?.time).toBe("15:00");
    expect(later?.hasDate).toBe(false);
  });

  it("returns null when there is no date reference at all", () => {
    expect(parseNaturalDate("write the report", NOW)).toBeNull();
    expect(parseNaturalDate("", NOW)).toBeNull();
  });
});
