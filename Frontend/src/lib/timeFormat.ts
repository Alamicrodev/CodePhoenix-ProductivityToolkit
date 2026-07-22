const MINUTES_PER_HOUR = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function parseClockTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
}

export function formatClockTime12(value: string) {
  const { hours, minutes } = parseClockTime(value);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${pad(minutes)} ${period}`;
}

export function splitClockTime12(value: string) {
  const { hours, minutes } = parseClockTime(value);
  return {
    hour: hours % 12 || 12,
    minute: minutes,
    period: hours >= 12 ? ("PM" as const) : ("AM" as const),
  };
}

export function toClockTime24(hour: number, minute: number, period: "AM" | "PM") {
  const normalizedHour = hour % 12;
  const hours = period === "PM" ? normalizedHour + 12 : normalizedHour;
  return `${pad(hours)}:${pad(Math.max(0, Math.min(minute, MINUTES_PER_HOUR - 1)))}`;
}

export function parseDateOnlyLocal(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateKeyLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfLocalDay(date: Date) {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function formatRelativeDayLabel(date: Date, now = new Date()) {
  const day = startOfLocalDay(date);
  const today = startOfLocalDay(now);
  const diffDays = Math.round((day.getTime() - today.getTime()) / DAY_MS);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  if (diffDays >= -6 && diffDays <= 6) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }

  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatRelativeDueLabel(dueDate: string | null, dueTime: string | null, now = new Date()) {
  if (!dueDate) return "No due date";

  const day = parseDateOnlyLocal(dueDate);
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today.getTime());
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (dueTime) {
    const { hours, minutes } = parseClockTime(dueTime);
    day.setHours(hours, minutes, 0, 0);

    const diffMs = day.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes <= 0) return "Overdue";
    if (diffMinutes < 60) return `Due in ${diffMinutes} min`;
    if (diffMinutes < 24 * 60) return `Due in ${Math.round(diffMinutes / 60)} hour${Math.round(diffMinutes / 60) === 1 ? "" : "s"}`;
  }

  if (day.getTime() === today.getTime()) return "Due today";
  if (day.getTime() === tomorrow.getTime()) return "Due tomorrow";
  if (day > today && day <= weekEnd) return "Due this week";

  return `Due ${day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
