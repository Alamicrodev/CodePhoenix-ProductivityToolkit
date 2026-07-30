import { toast } from "sonner";
import { Task, useData } from "../../context/DataContext";

/** Complete/reopen toggle with the "Task completed — Undo" toast. */
export function useCompleteTask() {
  const { updateTask } = useData();

  return async (task: Task) => {
    const newCompleted = !task.completed;
    const ok = await updateTask(task.id, {
      completed: newCompleted,
      completedAt: newCompleted ? new Date().toISOString() : null,
    });
    if (ok && newCompleted) {
      toast.success("Task completed", {
        action: {
          label: "Undo",
          onClick: () => {
            void updateTask(task.id, { completed: false, completedAt: null });
          },
        },
      });
    }
    return ok;
  };
}
