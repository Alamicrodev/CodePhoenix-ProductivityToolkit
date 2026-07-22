import { Task } from "../context/DataContext";

export interface FocusQuickAddResult {
  totalMinutes: number;
  focusMinutes: number;
  breakMinutes: number;
  taskIds: string[];
}

/**
 * Parses the Focus quick-add: `2h on roadmap review, 25/5` →
 * total length, focus/break split (defaults 25/5), and an "on <text>" task
 * match against active task titles.
 */
export function parseFocusQuickAdd(input: string, activeTasks: Task[]): FocusQuickAddResult | null {
  let text = input.trim();
  if (!text) return null;

  let totalMinutes = 60;
  const hoursMatch = text.match(/\b(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/i);
  const minutesMatch = text.match(/\b(\d+)\s*m(?:in|ins|inutes)?\b/i);
  if (hoursMatch) {
    totalMinutes = Math.round(parseFloat(hoursMatch[1]) * 60);
    text = text.replace(hoursMatch[0], "");
  } else if (minutesMatch) {
    totalMinutes = parseInt(minutesMatch[1], 10);
    text = text.replace(minutesMatch[0], "");
  }

  let focusMinutes = 25;
  let breakMinutes = 5;
  const splitMatch = text.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (splitMatch) {
    focusMinutes = parseInt(splitMatch[1], 10);
    breakMinutes = parseInt(splitMatch[2], 10);
    text = text.replace(splitMatch[0], "");
  }

  const taskIds: string[] = [];
  const onMatch = text.match(/\bon\s+(.+)$/i);
  if (onMatch) {
    const query = onMatch[1].replace(/[،,]+\s*$/, "").trim().toLowerCase();
    if (query) {
      const matched = activeTasks.find(task => task.title.toLowerCase().includes(query));
      if (matched) taskIds.push(matched.id);
    }
  }

  if (totalMinutes <= 0) return null;
  return {
    totalMinutes,
    focusMinutes: Math.max(1, Math.min(focusMinutes, totalMinutes)),
    breakMinutes: Math.max(1, breakMinutes),
    taskIds,
  };
}
