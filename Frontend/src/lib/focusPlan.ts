// The shape of a focus session: how a total duration splits into repeating
// focus and break periods, and how those numbers are worded in the UI.
// Pure functions only — the setup modal, the plan preview, and the running
// session strip all render from the same sequence.

export type PlanSegmentKind = "focus" | "break";

export interface PlanSegment {
  kind: PlanSegmentKind;
  minutes: number;
}

export interface PlanShape {
  segments: PlanSegment[];
  focusCount: number;
  breakCount: number;
  /** Total focus minutes — differs from the session total once breaks are in. */
  focusMinutes: number;
}

/**
 * Splits `totalMinutes` into focus periods separated by breaks.
 *
 * Two rules keep the tail sane: a leftover no longer than one break is absorbed
 * into the final focus block rather than becoming a stub period, and a session
 * never ends on a break — a break the user would sit through with nothing after
 * it is time they were promised for work.
 */
export function buildPlan(totalMinutes: number, focusMinutes: number, breakMinutes: number): PlanShape {
  const total = Math.max(0, Math.round(totalMinutes));
  const focusLength = Math.max(1, Math.round(focusMinutes));
  const breakLength = Math.max(0, Math.round(breakMinutes));

  if (total === 0) {
    return { segments: [], focusCount: 0, breakCount: 0, focusMinutes: 0 };
  }

  const segments: PlanSegment[] = [];
  let remaining = total;

  // A break length of 0 ("No breaks") would otherwise loop forever placing
  // zero-minute breaks; the whole session is one focus block.
  if (breakLength === 0) {
    segments.push({ kind: "focus", minutes: total });
  } else {
    while (remaining > 0) {
      const length = Math.min(focusLength, remaining);
      segments.push({ kind: "focus", minutes: length });
      remaining -= length;

      if (remaining === 0) {
        break;
      }

      // Too little left to be worth a break plus anything after it: fold it
      // into the block we just placed and finish.
      if (remaining <= breakLength) {
        segments[segments.length - 1].minutes += remaining;
        remaining = 0;
        break;
      }

      segments.push({ kind: "break", minutes: breakLength });
      remaining -= breakLength;
    }
  }

  const focusSegments = segments.filter(segment => segment.kind === "focus");

  return {
    segments,
    focusCount: focusSegments.length,
    breakCount: segments.length - focusSegments.length,
    focusMinutes: focusSegments.reduce((sum, segment) => sum + segment.minutes, 0),
  };
}

export interface PlanPosition {
  /** Index into the segments of the block running now; -1 once the session is over. */
  index: number;
  /** Progress through the current block, 0–1. */
  fraction: number;
  /** 1-based number of the current focus block; 0 while on a break. */
  focusBlockNumber: number;
  /** Focus blocks fully behind us. */
  focusBlocksDone: number;
}

/**
 * Where `elapsedSeconds` falls in the sequence. Derived from elapsed time rather
 * than tracked separately so the strip, the phase label, and the clock can never
 * drift apart.
 */
export function locatePlanPosition(segments: PlanSegment[], elapsedSeconds: number): PlanPosition {
  const elapsed = Math.max(0, elapsedSeconds);
  let consumed = 0;
  let focusBlocksDone = 0;
  let focusBlockNumber = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const length = segment.minutes * 60;
    if (segment.kind === "focus") {
      focusBlockNumber += 1;
    }

    // The boundary second belongs to the next block, matching the clock.
    if (elapsed < consumed + length) {
      return {
        index,
        fraction: length > 0 ? (elapsed - consumed) / length : 0,
        focusBlockNumber: segment.kind === "focus" ? focusBlockNumber : 0,
        focusBlocksDone,
      };
    }

    consumed += length;
    if (segment.kind === "focus") {
      focusBlocksDone += 1;
    }
  }

  return { index: -1, fraction: 1, focusBlockNumber: 0, focusBlocksDone };
}

/**
 * Reads the durations people actually type: "1h 45m", "1h", "45m", a bare "105"
 * (minutes), or a clock-style "1:45". Returns null when there is no sane number
 * in there, so the caller can leave the field alone rather than guess.
 */
export function parseDurationInput(raw: string): number | null {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return null;
  }

  const clock = value.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (clock) {
    return toValidMinutes(Number(clock[1]) * 60 + Number(clock[2]));
  }

  const units = value.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?$/);
  if (units && (units[1] || units[2])) {
    const hours = units[1] ? Number(units[1]) : 0;
    const minutes = units[2] ? Number(units[2]) : 0;
    return toValidMinutes(hours * 60 + minutes);
  }

  if (/^\d+$/.test(value)) {
    return toValidMinutes(Number(value));
  }

  return null;
}

function toValidMinutes(minutes: number): number | null {
  const rounded = Math.round(minutes);
  // A session longer than a day is a typo, not a plan.
  return rounded > 0 && rounded <= 24 * 60 ? rounded : null;
}

/** 120 → "2h", 105 → "1h 45m", 50 → "50m". */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The big timer: "24:31" under an hour, "1:02:11" over it. */
export function formatTimerDigits(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** Wall-clock label used for start/end times: "6:45 PM". */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "50/10", or "No breaks" when the session is one unbroken block. */
export function rhythmLabel(focusMinutes: number, breakMinutes: number): string {
  return breakMinutes > 0 ? `${Math.round(focusMinutes)}/${Math.round(breakMinutes)}` : "No breaks";
}

/** Sessions name themselves from their shape: "2h · 50/10". */
export function sessionTitle(totalMinutes: number, focusMinutes: number, breakMinutes: number): string {
  // A focus period as long as the session leaves no room for a break, whatever
  // break length got stored alongside it.
  const rhythm =
    focusMinutes >= totalMinutes ? "No breaks" : rhythmLabel(focusMinutes, breakMinutes);
  return `${formatMinutes(totalMinutes)} · ${rhythm}`;
}

/** "4 × focus · 3 × 10m break · ends 6:45 PM" under the plan preview. */
export function describePlan(plan: PlanShape, breakMinutes: number, endsAt: Date): string {
  const parts = [`${plan.focusCount} × focus`];
  if (plan.breakCount > 0) {
    parts.push(`${plan.breakCount} × ${formatMinutes(breakMinutes)} break`);
  }
  parts.push(`ends ${formatClock(endsAt)}`);
  return parts.join(" · ");
}
