import type { Habit } from "../context/DataContext";
import { formatRelativeDayLabel, parseClockTime } from "./timeFormat";

export type HabitOccurrenceStatus = "completed" | "skipped" | "missed" | "pending";

export interface HabitHistorySlot {
  start: Date;
  end: Date;
  status: HabitOccurrenceStatus;
  label: string;
}

const HOUR_MS = 60 * 60 * 1000;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function startOfLocalDay(date: Date) {
  const copy = cloneDate(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfLocalDay(date: Date) {
  const copy = cloneDate(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = cloneDate(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function addHours(date: Date, amount: number) {
  return new Date(date.getTime() + amount * HOUR_MS);
}

function startOfWeek(date: Date) {
  const copy = startOfLocalDay(date);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function parseStoredDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime12(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${pad(minutes)} ${period}`;
}

function formatHourlyLabel(start: Date, end: Date) {
  return `${formatRelativeDayLabel(start)} ${formatTime12(start)}`;
}

function formatDailyLabel(start: Date) {
  return formatRelativeDayLabel(start);
}

function formatWeeklyLabel(start: Date, end: Date) {
  return `${formatRelativeDayLabel(start)}`;
}

function formatHabitDueSoonLabel(habit: Habit, now: Date) {
  if (habit.frequency === "hourly") {
    const currentSlot = getCurrentHourlySlot(habit, now);
    if (!currentSlot) {
      return "";
    }

    const diffMinutes = Math.max(1, Math.round((currentSlot.end.getTime() - now.getTime()) / 60000));
    if (diffMinutes < 60) {
      return `Due in ${diffMinutes} min`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    return `Due in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }

  if (habit.frequency === "daily") {
    return "Due today";
  }

  return "Due this week";
}

function isActiveDay(habit: Habit, date: Date) {
  const activeDays = habit.activeDays ?? [];
  return activeDays.length === 0 || activeDays.includes(date.getDay());
}

function isWithinActiveHours(habit: Habit, date: Date) {
  if (habit.frequency !== "hourly" || !habit.activeHours) {
    return true;
  }

  const { hours: startHours, minutes: startMinutes } = parseClockTime(habit.activeHours.start);
  const { hours: endHours, minutes: endMinutes } = parseClockTime(habit.activeHours.end);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutesOfDay = startHours * 60 + startMinutes;
  const endMinutesOfDay = endHours * 60 + endMinutes;

  if (startMinutesOfDay === endMinutesOfDay) {
    return true;
  }

  if (startMinutesOfDay < endMinutesOfDay) {
    return currentMinutes >= startMinutesOfDay && currentMinutes < endMinutesOfDay;
  }

  return currentMinutes >= startMinutesOfDay || currentMinutes < endMinutesOfDay;
}

function getHourlyWindowBounds(habit: Habit, date: Date) {
  const dayStart = startOfLocalDay(date);

  if (!habit.activeHours) {
    return {
      start: dayStart,
      end: endOfLocalDay(date),
    };
  }

  const { hours: startHours, minutes: startMinutes } = parseClockTime(habit.activeHours.start);
  const { hours: endHours, minutes: endMinutes } = parseClockTime(habit.activeHours.end);
  const start = cloneDate(dayStart);
  start.setHours(startHours, startMinutes, 0, 0);

  const end = cloneDate(dayStart);
  end.setHours(endHours, endMinutes, 0, 0);

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

function hasCompletionInRange(habit: Habit, start: Date, end: Date) {
  if (habit.frequency === "hourly") {
    return habit.completedDates.some(entry => {
      const completion = new Date(entry);
      return completion >= start && completion < end;
    });
  }

  if (habit.frequency === "daily") {
    const targetKey = localDateKey(start);
    return habit.completedDates.some(entry => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(entry)) {
        return entry === targetKey;
      }

      return localDateKey(parseStoredDate(entry)) === targetKey;
    });
  }

  const weekEnd = new Date(end.getTime() - 1);
  return habit.completedDates.some(entry => {
    const completion = parseStoredDate(entry);
    return completion >= start && completion <= weekEnd;
  });
}

function hasSkipInRange(habit: Habit, start: Date, end: Date) {
  const skips = habit.occurrences ?? [];

  if (habit.frequency === "hourly") {
    return skips.some(occ => {
      if (occ.status !== "skipped") {
        return false;
      }

      const skippedAt = new Date(occ.timestamp);
      return skippedAt >= start && skippedAt < end;
    });
  }

  if (habit.frequency === "daily") {
    const targetKey = localDateKey(start);
    return skips.some(occ => occ.status === "skipped" && localDateKey(parseStoredDate(occ.timestamp)) === targetKey);
  }

  const weekEnd = new Date(end.getTime() - 1);
  return skips.some(occ => {
    if (occ.status !== "skipped") {
      return false;
    }

    const skippedAt = parseStoredDate(occ.timestamp);
    return skippedAt >= start && skippedAt <= weekEnd;
  });
}

function createSlot(
  habit: Habit,
  start: Date,
  end: Date,
  now: Date,
): HabitHistorySlot {
  const completed = hasCompletionInRange(habit, start, end);
  const skipped = !completed && hasSkipInRange(habit, start, end);
  const status: HabitOccurrenceStatus = completed
    ? "completed"
    : skipped
      ? "skipped"
      : end <= now
        ? "missed"
        : "pending";

  let label = "";

  if (habit.frequency === "hourly") {
    label = formatHourlyLabel(start, end);
  } else if (habit.frequency === "daily") {
    label = formatDailyLabel(start);
  } else {
    label = formatWeeklyLabel(start, end);
  }

  return { start, end, status, label };
}

function buildHourlySlotsForDay(habit: Habit, day: Date, cutoff: Date, createdAt?: Date | null) {
  const intervalHours = habit.hourlyInterval || 1;
  const slots: HabitHistorySlot[] = [];
  const { start: activeStart, end: activeEnd } = getHourlyWindowBounds(habit, day);
  const effectiveCutoff = cutoff < activeEnd ? cutoff : activeEnd;

  let slotStart = cloneDate(activeStart);
  while (slotStart < activeEnd) {
    const slotEnd = addHours(slotStart, intervalHours);
    const boundedSlotEnd = slotEnd < activeEnd ? slotEnd : cloneDate(activeEnd);

    if (createdAt && boundedSlotEnd <= createdAt) {
      slotStart = cloneDate(boundedSlotEnd);
      if (boundedSlotEnd >= activeEnd) {
        break;
      }
      continue;
    }

    if (slotStart <= effectiveCutoff) {
      slots.push(createSlot(habit, slotStart, boundedSlotEnd, cutoff));
    } else {
      break;
    }

    slotStart = cloneDate(boundedSlotEnd);

    if (boundedSlotEnd >= activeEnd) {
      break;
    }
  }

  return slots;
}

function generateHourlySlots(habit: Habit, now: Date, limit: number, createdAt?: Date | null) {
  const slots: HabitHistorySlot[] = [];
  const dayCursor = startOfLocalDay(now);
  const earliestDay = createdAt ? startOfLocalDay(createdAt) : addDays(dayCursor, -30);

  for (let day = dayCursor; day >= earliestDay && slots.length < limit; day = addDays(day, -1)) {
    if (!isActiveDay(habit, day)) {
      continue;
    }

    const cutoff = day.getTime() === dayCursor.getTime() ? now : endOfLocalDay(day);
    const daySlots = buildHourlySlotsForDay(habit, day, cutoff, createdAt);

    for (let index = daySlots.length - 1; index >= 0 && slots.length < limit; index -= 1) {
      slots.push(daySlots[index]);
    }
  }

  return slots.reverse();
}

function generateDailySlots(habit: Habit, now: Date, limit: number, createdAt?: Date | null) {
  const slots: HabitHistorySlot[] = [];
  const dayCursor = startOfLocalDay(now);
  const earliestDay = createdAt ? startOfLocalDay(createdAt) : addDays(dayCursor, -30);

  for (let day = dayCursor; day >= earliestDay && slots.length < limit; day = addDays(day, -1)) {
    if (!isActiveDay(habit, day)) {
      continue;
    }

    const slotStart = startOfLocalDay(day);
    const slotEnd = endOfLocalDay(day);

    if (createdAt && slotEnd <= createdAt) {
      continue;
    }

    slots.push(createSlot(habit, slotStart, slotEnd, now));
  }

  return slots.reverse();
}

function generateWeeklySlots(habit: Habit, now: Date, limit: number, createdAt?: Date | null) {
  const slots: HabitHistorySlot[] = [];
  const weekCursor = startOfWeek(now);
  const earliestWeek = createdAt ? startOfWeek(createdAt) : addDays(weekCursor, -12 * 7);

  for (let weekStart = weekCursor; weekStart >= earliestWeek && slots.length < limit; weekStart = addDays(weekStart, -7)) {
    const weekEnd = addDays(weekStart, 7);

    if (createdAt && weekEnd <= createdAt) {
      continue;
    }

    slots.push(createSlot(habit, weekStart, weekEnd, now));
  }

  return slots.reverse();
}

export function buildHabitHistorySlots(habit: Habit, now: Date, limit = 30) {
  const createdAt = habit.createdAt ? new Date(habit.createdAt) : null;

  if (habit.frequency === "hourly") {
    return generateHourlySlots(habit, now, limit, createdAt);
  }

  if (habit.frequency === "daily") {
    return generateDailySlots(habit, now, limit, createdAt);
  }

  return generateWeeklySlots(habit, now, limit, createdAt);
}

function getCurrentHourlySlot(habit: Habit, now: Date) {
  if (!isActiveDay(habit, now) || !isWithinActiveHours(habit, now)) {
    return null;
  }

  const intervalHours = habit.hourlyInterval || 1;
  const { start: activeStart, end: activeEnd } = getHourlyWindowBounds(habit, now);
  let slotStart = cloneDate(activeStart);

  while (slotStart < activeEnd) {
    const slotEnd = addHours(slotStart, intervalHours);
    const boundedSlotEnd = slotEnd < activeEnd ? slotEnd : cloneDate(activeEnd);

    if (now >= slotStart && now < boundedSlotEnd) {
      return { start: slotStart, end: boundedSlotEnd };
    }

    slotStart = cloneDate(boundedSlotEnd);

    if (boundedSlotEnd >= activeEnd) {
      break;
    }
  }

  return null;
}

export function canCompleteHabitNow(habit: Habit, now: Date) {
  if (!isActiveDay(habit, now)) {
    return false;
  }

  if (habit.frequency === "hourly") {
    const currentSlot = getCurrentHourlySlot(habit, now);
    return Boolean(currentSlot) && !hasCompletionInRange(habit, currentSlot!.start, currentSlot!.end);
  }

  if (habit.frequency === "daily") {
    const todaySlotStart = startOfLocalDay(now);
    return !hasCompletionInRange(habit, todaySlotStart, endOfLocalDay(now));
  }

  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  return !hasCompletionInRange(habit, weekStart, weekEnd);
}

export function getHabitNextOccurrence(habit: Habit, now: Date) {
  if (habit.frequency === "hourly") {
    const currentSlot = getCurrentHourlySlot(habit, now);

    if (currentSlot && !hasCompletionInRange(habit, currentSlot.start, currentSlot.end)) {
      return currentSlot;
    }

    const intervalHours = habit.hourlyInterval || 1;
    const { start: activeStart, end: activeEnd } = getHourlyWindowBounds(habit, now);
    let slotStart = cloneDate(activeStart);

    while (slotStart < activeEnd) {
      const slotEnd = addHours(slotStart, intervalHours);
      const boundedSlotEnd = slotEnd < activeEnd ? slotEnd : cloneDate(activeEnd);

      if (slotStart > now) {
        return { start: slotStart, end: boundedSlotEnd };
      }

      slotStart = cloneDate(boundedSlotEnd);

      if (boundedSlotEnd >= activeEnd) {
        break;
      }
    }

    let nextDay = addDays(startOfLocalDay(now), 1);
    for (let i = 0; i < 14; i++) {
      if (isActiveDay(habit, nextDay)) {
        const window = getHourlyWindowBounds(habit, nextDay);
        return { start: window.start, end: addHours(window.start, intervalHours) < window.end ? addHours(window.start, intervalHours) : window.end };
      }

      nextDay = addDays(nextDay, 1);
    }

    return { start: now, end: now };
  }

  if (habit.frequency === "daily") {
    const todayStart = startOfLocalDay(now);
    const todayEnd = endOfLocalDay(now);

    if (isActiveDay(habit, now) && !hasCompletionInRange(habit, todayStart, todayEnd)) {
      return { start: todayStart, end: todayEnd };
    }

    let nextDay = addDays(todayStart, 1);
    for (let i = 0; i < 30; i++) {
      if (isActiveDay(habit, nextDay)) {
        return { start: startOfLocalDay(nextDay), end: endOfLocalDay(nextDay) };
      }

      nextDay = addDays(nextDay, 1);
    }

    return { start: now, end: now };
  }

  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  if (!hasCompletionInRange(habit, weekStart, weekEnd)) {
    return { start: weekStart, end: weekEnd };
  }

  let nextWeekStart = addDays(weekStart, 7);
  for (let i = 0; i < 30; i++) {
    const nextWeekEnd = addDays(nextWeekStart, 7);
    if (!hasCompletionInRange(habit, nextWeekStart, nextWeekEnd)) {
      return { start: nextWeekStart, end: nextWeekEnd };
    }

    nextWeekStart = addDays(nextWeekStart, 7);
  }

  return { start: now, end: now };
}

export function isHabitCurrentlyActive(habit: Habit, now: Date) {
  return isActiveDay(habit, now) && (habit.frequency !== "hourly" || isWithinActiveHours(habit, now));
}

export function formatHabitNextOccurrence(habit: Habit, now: Date) {
  if (canCompleteHabitNow(habit, now)) {
    const dueSoonLabel = formatHabitDueSoonLabel(habit, now);
    return dueSoonLabel ? `Available now · ${dueSoonLabel}` : "Available now";
  }

  const nextOccurrence = getHabitNextOccurrence(habit, now);

  if (habit.frequency === "hourly") {
    return `Next window: ${formatHourlyLabel(nextOccurrence.start, nextOccurrence.end)}`;
  }

  if (habit.frequency === "daily") {
    return `Next window: ${formatDailyLabel(nextOccurrence.start)}`;
  }

  return `Next window: ${formatWeeklyLabel(nextOccurrence.start, nextOccurrence.end)}`;
}
