import { describe, expect, it } from "vitest";

import { formatClockTime12, parseTimeInput } from "./timeFormat";

describe("parseTimeInput", () => {
  it("reads a bare hour as the top of that hour", () => {
    expect(parseTimeInput("9")).toBe("09:00");
    expect(parseTimeInput("21")).toBe("21:00");
    expect(parseTimeInput("0")).toBe("00:00");
  });

  it("reads 24-hour clock times", () => {
    expect(parseTimeInput("09:30")).toBe("09:30");
    expect(parseTimeInput("21:30")).toBe("21:30");
    expect(parseTimeInput("23:59")).toBe("23:59");
  });

  it("splits a run-together time", () => {
    expect(parseTimeInput("930")).toBe("09:30");
    expect(parseTimeInput("0930")).toBe("09:30");
    expect(parseTimeInput("2130")).toBe("21:30");
  });

  it("applies am/pm, in long and short form", () => {
    expect(parseTimeInput("9pm")).toBe("21:00");
    expect(parseTimeInput("9:30pm")).toBe("21:30");
    expect(parseTimeInput("9 PM")).toBe("21:00");
    expect(parseTimeInput("9a")).toBe("09:00");
    expect(parseTimeInput("9p")).toBe("21:00");
  });

  it("gets the two hours everyone gets wrong right", () => {
    expect(parseTimeInput("12am")).toBe("00:00");
    expect(parseTimeInput("12pm")).toBe("12:00");
    expect(parseTimeInput("12:30am")).toBe("00:30");
  });

  it("tolerates surrounding whitespace and case", () => {
    expect(parseTimeInput("  9:30 Pm  ")).toBe("21:30");
  });

  it("returns null for a draft that is not a time yet", () => {
    // A half-typed field has to keep its keystrokes, so these are not errors.
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("   ")).toBeNull();
    expect(parseTimeInput(":")).toBeNull();
    expect(parseTimeInput("9:3")).toBeNull();
  });

  it("rejects impossible times", () => {
    expect(parseTimeInput("24:00")).toBeNull();
    expect(parseTimeInput("25")).toBeNull();
    expect(parseTimeInput("9:60")).toBeNull();
    expect(parseTimeInput("13pm")).toBeNull();
    expect(parseTimeInput("0pm")).toBeNull();
    expect(parseTimeInput("tomorrow")).toBeNull();
    expect(parseTimeInput("9:30:00")).toBeNull();
  });

  it("round-trips through the 12-hour formatter", () => {
    for (const input of ["9", "9:30pm", "2130", "12am", "12pm"]) {
      const parsed = parseTimeInput(input);
      expect(parsed).not.toBeNull();
      expect(parseTimeInput(formatClockTime12(parsed as string))).toBe(parsed);
    }
  });
});
