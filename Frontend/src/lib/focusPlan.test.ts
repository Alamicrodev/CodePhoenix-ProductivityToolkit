import { describe, expect, it } from "vitest";

import {
  buildPlan,
  describePlan,
  formatMinutes,
  formatTimerDigits,
  locatePlanPosition,
  parseDurationInput,
  rhythmLabel,
  sessionTitle,
} from "./focusPlan";

const shape = (totalMinutes: number, focus: number, breakLength: number) =>
  buildPlan(totalMinutes, focus, breakLength).segments.map(
    segment => `${segment.kind === "focus" ? "F" : "B"}${segment.minutes}`,
  );

describe("buildPlan", () => {
  it("fills a session with focus periods separated by breaks", () => {
    // 4h at 50/10 is the handoff's worked example: four focus blocks, three breaks.
    const plan = buildPlan(240, 50, 10);

    expect(plan.focusCount).toBe(4);
    expect(plan.breakCount).toBe(3);
    expect(plan.segments.reduce((sum, segment) => sum + segment.minutes, 0)).toBe(240);
  });

  it("absorbs a leftover no longer than one break into the final focus block", () => {
    // The last 10 minutes would be a stub period on its own, so the closing
    // focus block runs 60 instead.
    expect(shape(240, 50, 10)).toEqual(["F50", "B10", "F50", "B10", "F50", "B10", "F60"]);
  });

  it("never ends on a break", () => {
    for (const total of [45, 60, 95, 125, 180, 240, 300]) {
      const segments = buildPlan(total, 50, 10).segments;
      expect(segments[segments.length - 1].kind).toBe("focus");
    }
  });

  it("always accounts for exactly the requested minutes", () => {
    for (const total of [25, 50, 51, 95, 125, 181, 300]) {
      const plan = buildPlan(total, 50, 10);
      expect(plan.segments.reduce((sum, segment) => sum + segment.minutes, 0)).toBe(total);
    }
  });

  it("runs as one unbroken block when breaks are switched off", () => {
    expect(shape(180, 50, 0)).toEqual(["F180"]);
  });

  it("keeps a session shorter than one focus period in a single block", () => {
    expect(shape(25, 50, 10)).toEqual(["F25"]);
  });

  it("has no segments for an empty session", () => {
    expect(buildPlan(0, 50, 10).segments).toEqual([]);
  });

  it("counts focus minutes separately from the session total", () => {
    expect(buildPlan(240, 50, 10).focusMinutes).toBe(210);
  });
});

describe("locatePlanPosition", () => {
  // 4h at 50/10: F50 B10 F50 B10 F50 B10 F60.
  const segments = buildPlan(240, 50, 10).segments;

  it("finds the opening focus block at the start", () => {
    const at = locatePlanPosition(segments, 0);
    expect(at.index).toBe(0);
    expect(at.fraction).toBe(0);
    expect(at.focusBlockNumber).toBe(1);
    expect(at.focusBlocksDone).toBe(0);
  });

  it("reports progress through the block it is inside", () => {
    const at = locatePlanPosition(segments, 25 * 60);
    expect(at.index).toBe(0);
    expect(at.fraction).toBeCloseTo(0.5);
  });

  it("hands the boundary second to the next block", () => {
    // 50m exactly is the first second of the break, not the last of the focus.
    const at = locatePlanPosition(segments, 50 * 60);
    expect(at.index).toBe(1);
    expect(at.focusBlockNumber).toBe(0);
    expect(at.focusBlocksDone).toBe(1);
  });

  it("numbers focus blocks past the breaks between them", () => {
    // 90m is inside the second focus block, which spans 60m–110m.
    const at = locatePlanPosition(segments, 90 * 60);
    expect(at.index).toBe(2);
    expect(at.focusBlockNumber).toBe(2);
    expect(at.focusBlocksDone).toBe(1);
  });

  it("reports a break as no focus block at all", () => {
    // 115m is inside the second break, which spans 110m–120m.
    expect(locatePlanPosition(segments, 115 * 60).focusBlockNumber).toBe(0);
  });

  it("runs off the end once the session is spent", () => {
    const at = locatePlanPosition(segments, 240 * 60);
    expect(at.index).toBe(-1);
    expect(at.focusBlocksDone).toBe(4);
  });
});

describe("parseDurationInput", () => {
  it("reads the formats people type", () => {
    expect(parseDurationInput("1h 45m")).toBe(105);
    expect(parseDurationInput("105")).toBe(105);
    expect(parseDurationInput("1:45")).toBe(105);
    expect(parseDurationInput("2h")).toBe(120);
    expect(parseDurationInput("90m")).toBe(90);
    expect(parseDurationInput("90 min")).toBe(90);
    expect(parseDurationInput("  2H  ")).toBe(120);
  });

  it("rejects what it cannot turn into a session", () => {
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("soon")).toBeNull();
    expect(parseDurationInput("0")).toBeNull();
    expect(parseDurationInput("-30")).toBeNull();
    // Longer than a day is a typo, not a plan.
    expect(parseDurationInput("30h")).toBeNull();
  });
});

describe("labels", () => {
  it("formats minutes for humans", () => {
    expect(formatMinutes(50)).toBe("50m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(105)).toBe("1h 45m");
  });

  it("grows the timer to hours only when it needs to", () => {
    expect(formatTimerDigits(1471)).toBe("24:31");
    expect(formatTimerDigits(3731)).toBe("1:02:11");
    expect(formatTimerDigits(0)).toBe("0:00");
    // A tick past the end should read as zero, never as a negative clock.
    expect(formatTimerDigits(-5)).toBe("0:00");
  });

  it("names a session after its shape", () => {
    expect(sessionTitle(120, 50, 10)).toBe("2h · 50/10");
    expect(rhythmLabel(50, 0)).toBe("No breaks");
  });

  it("calls an unbroken session 'No breaks' whatever break length was stored", () => {
    // A break-free session still carries a break length on the API model, so the
    // title has to read the shape rather than the raw field.
    expect(sessionTitle(120, 120, 1)).toBe("2h · No breaks");
  });

  it("describes a plan under the preview strip", () => {
    const endsAt = new Date(2026, 7, 1, 18, 45);
    expect(describePlan(buildPlan(240, 50, 10), 10, endsAt)).toBe(
      "4 × focus · 3 × 10m break · ends 6:45 PM",
    );
  });

  it("leaves the break clause out when there are no breaks", () => {
    const endsAt = new Date(2026, 7, 1, 18, 45);
    expect(describePlan(buildPlan(180, 50, 0), 0, endsAt)).toBe("1 × focus · ends 6:45 PM");
  });
});
