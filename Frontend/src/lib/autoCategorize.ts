import { Task } from "../context/DataContext";
import { daysUntilDue } from "./taskDates";

export type Quadrant = NonNullable<Task["quadrant"]>;

/** Urgent = due within 2 days; important = high or medium priority. */
export function suggestQuadrant(
  task: Pick<Task, "dueDate" | "priority">,
  now = new Date(),
): Quadrant {
  const isUrgent = task.dueDate !== null && daysUntilDue(task.dueDate, now) <= 2;
  const isImportant = task.priority === "high" || task.priority === "medium";

  if (isUrgent && isImportant) return "urgent-important";
  if (!isUrgent && isImportant) return "not-urgent-important";
  if (isUrgent && !isImportant) return "urgent-not-important";
  return "not-urgent-not-important";
}

/**
 * Assign quadrants to active tasks. By default only fills in tasks that have
 * no quadrant yet; `recategorizeAll` re-evaluates every active task.
 * Returns how many tasks were updated.
 */
export async function autoCategorizeTasks(
  tasks: Task[],
  updateTask: (id: string, updates: Partial<Task>) => Promise<boolean>,
  options: { recategorizeAll?: boolean } = {},
): Promise<number> {
  const targets = tasks.filter(
    task => !task.completed && (options.recategorizeAll || !task.quadrant),
  );

  await Promise.all(targets.map(task => updateTask(task.id, { quadrant: suggestQuadrant(task) })));
  return targets.length;
}
