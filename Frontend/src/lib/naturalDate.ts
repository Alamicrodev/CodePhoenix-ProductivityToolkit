import * as chrono from "chrono-node";

import { formatDateKeyLocal } from "./timeFormat";

export interface NaturalDateResult {
  /** "YYYY-MM-DD", local. */
  date: string;
  /** "HH:MM" when the text actually named a time, else null. */
  time: string | null;
  /** True when the text named a day, not just a clock time. */
  hasDate: boolean;
  /** The slice of the input chrono consumed, so callers can strip it. */
  text: string;
  index: number;
}

/**
 * Natural-language dates, via chrono.
 *
 * `chrono.en` is the US-style reader, so a bare "8/15" resolves to August
 * 15th. That matches the rest of the app — every toLocaleDateString call here
 * passes "en-US" — but it IS a regional guess, which is why every caller shows
 * the resolved date back rather than silently filing the task.
 *
 * `forwardDate` makes a bare weekday or month-day mean the next one still to
 * come, which is what someone setting a due date means. Without it, "friday"
 * typed on a Saturday resolves to yesterday.
 */
const FORWARD: { forwardDate: boolean } = { forwardDate: true };

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

/**
 * The first date or time chrono finds anywhere in the text, or null.
 *
 * A time with no day ("5pm") comes back as today at that time with
 * hasDate false, so callers can decide whether that counts.
 */
export function parseNaturalDate(raw: string, now = new Date()): NaturalDateResult | null {
  if (!raw.trim()) {
    return null;
  }

  // Parse the string as given, never a trimmed copy: `index` is what callers
  // splice on, so it has to line up with the input they hold.
  const [result] = chrono.en.parse(raw, now, FORWARD);
  if (!result) {
    return null;
  }

  // isCertain distinguishes what the text actually said from what chrono
  // implied to fill the gaps. Reading an implied hour would give "friday" a
  // due time of 12:00 that nobody asked for.
  const start = result.start;
  const hasDate =
    start.isCertain("year") ||
    start.isCertain("month") ||
    start.isCertain("day") ||
    start.isCertain("weekday");
  const hasTime = start.isCertain("hour");

  if (!hasDate && !hasTime) {
    return null;
  }

  const date = result.start.date();
  return {
    date: formatDateKeyLocal(date),
    time: hasTime ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : null,
    hasDate,
    text: result.text,
    index: result.index,
  };
}

/**
 * Stricter parse for the editor's custom date field.
 *
 * Two guards, both earned from watching chrono's real output:
 *
 * 1. The whole string must be the date reference. "buy milk friday" is a
 *    quick-add draft, not a date-field entry, and "end of the month" parses to
 *    a month from today while consuming only "the month" — a wrong answer,
 *    which the leftover text catches.
 * 2. It must name a day. "9:30pm" is a valid chrono parse but belongs to the
 *    Time chip, not this one.
 */
/**
 * Date reference for a quick-add draft, deliberately more cautious than chrono.
 *
 * Two rules, both earned by running chrono over realistic task titles:
 *
 * 1. **It must end the draft.** People write "pay rent tomorrow" and "email bob
 *    monday" — the date trails. A bare month or weekday earlier in the line is
 *    almost always part of the name, and consuming it is destructive:
 *    "sunday roast prep" would become "roast prep" filed on Sunday, and
 *    "march on washington" would become "on washington" filed in March.
 * 2. **"now" is not a due date.** It is how English sentences end ("fix this
 *    now"), and "today" already says what it would mean.
 *
 * The cost is that a leading date ("tomorrow pay rent") is ignored. That is the
 * right trade: failing to parse is recoverable, eating a word is not.
 */
export function parseQuickAddDate(raw: string, now = new Date()): NaturalDateResult | null {
  const result = parseNaturalDate(raw, now);
  if (!result) {
    return null;
  }
  if (raw.slice(result.index + result.text.length).trim().length > 0) {
    return null;
  }
  if (/^now$/i.test(result.text.trim())) {
    return null;
  }
  return result;
}

export function parseDateFieldInput(raw: string, now = new Date()): NaturalDateResult | null {
  const result = parseNaturalDate(raw, now);
  if (!result || !result.hasDate) {
    return null;
  }
  const before = raw.slice(0, result.index);
  const after = raw.slice(result.index + result.text.length);
  const remainder = `${before}${after}`.replace(/[\s,.]/g, "");
  return remainder.length === 0 ? result : null;
}
