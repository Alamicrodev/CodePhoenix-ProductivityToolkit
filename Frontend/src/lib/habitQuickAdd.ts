import type { Habit } from "../context/DataContext";

export interface ParsedHabitQuickAdd {
  title: string;
  frequency: Habit["frequency"];
  /** Weekday indexes (0 = Sunday) when the draft named specific days. */
  activeDays: number[];
}

// "every weekday" / "weekdays" → Mon–Fri; "every weekend" → Sat+Sun.
const WEEKDAY_TOKEN = /(?:^|\s)(?:every\s+)?weekdays?\b/i;
const WEEKEND_TOKEN = /(?:^|\s)(?:every\s+)?weekends?\b/i;
const DAILY_TOKEN = /(?:^|\s)(?:every\s+day|daily)\b/i;
const WEEKLY_TOKEN = /(?:^|\s)(?:every\s+week|weekly)\b/i;
const HOURLY_TOKEN = /(?:^|\s)(?:every\s+hour|hourly)\b/i;
// A duration such as "10m" or "1h" reads as part of the habit's name
// ("meditate 10m"), so it is kept in the title rather than stripped.

const DAY_NAMES: Array<[RegExp, number]> = [
  [/(?:^|\s)(?:on\s+)?sun(?:day)?s?\b/i, 0],
  [/(?:^|\s)(?:on\s+)?mon(?:day)?s?\b/i, 1],
  [/(?:^|\s)(?:on\s+)?tue(?:s|sday)?s?\b/i, 2],
  [/(?:^|\s)(?:on\s+)?wed(?:nesday)?s?\b/i, 3],
  [/(?:^|\s)(?:on\s+)?thu(?:r|rs|rsday)?s?\b/i, 4],
  [/(?:^|\s)(?:on\s+)?fri(?:day)?s?\b/i, 5],
  [/(?:^|\s)(?:on\s+)?sat(?:urday)?s?\b/i, 6],
];

/**
 * Parses a habit quick-add draft such as
 *   `meditate 10m every weekday`
 *   `review inbox weekly`
 *   `stretch on mon wed fri`
 * into habit fields. Schedule tokens are stripped from the title; a duration
 * like "10m" is deliberately kept, because it names the habit.
 */
export function parseHabitQuickAdd(input: string): ParsedHabitQuickAdd {
  let rest = input;
  let frequency: Habit["frequency"] = "daily";
  let activeDays: number[] = [];

  const strip = (pattern: RegExp) => {
    rest = rest.replace(pattern, " ");
  };

  if (HOURLY_TOKEN.test(rest)) {
    frequency = "hourly";
    strip(HOURLY_TOKEN);
  } else if (WEEKLY_TOKEN.test(rest)) {
    frequency = "weekly";
    strip(WEEKLY_TOKEN);
  } else if (WEEKDAY_TOKEN.test(rest)) {
    frequency = "daily";
    activeDays = [1, 2, 3, 4, 5];
    strip(WEEKDAY_TOKEN);
  } else if (WEEKEND_TOKEN.test(rest)) {
    frequency = "daily";
    activeDays = [0, 6];
    strip(WEEKEND_TOKEN);
  } else if (DAILY_TOKEN.test(rest)) {
    frequency = "daily";
    strip(DAILY_TOKEN);
  } else {
    // Named weekdays, e.g. "on mon wed fri".
    const named: number[] = [];
    for (const [pattern, index] of DAY_NAMES) {
      if (pattern.test(rest)) {
        named.push(index);
        strip(pattern);
      }
    }
    if (named.length > 0) {
      frequency = "daily";
      activeDays = named.sort((a, b) => a - b);
    }
  }

  const title = rest.replace(/\s+/g, " ").trim();

  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : "",
    frequency,
    activeDays,
  };
}
