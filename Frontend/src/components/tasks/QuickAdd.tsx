import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "../../context/DataContext";
import { parseQuickAdd } from "../../lib/quickAdd";

/**
 * Always-visible one-line task capture. Enter creates the task optimistically,
 * clears the field, and keeps focus for rapid consecutive entry.
 */
export function QuickAdd() {
  const { addTask } = useData();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseQuickAdd(draft);
    if (!parsed.title) {
      return;
    }

    void addTask({
      title: parsed.title,
      description: "",
      completed: false,
      completedAt: null,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      dueTime: null,
      tags: [],
      subtasks: [],
      quadrant: parsed.quadrant,
    });

    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 transition-colors focus-within:border-ring/60">
        <Plus className="h-4 w-4 shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder='Add a task…  try "pay rent tomorrow !high"'
          aria-label="Quick add task"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-tertiary"
        />
        <span className="hidden shrink-0 font-mono text-[10px] text-tertiary md:inline">
          ↵ to add · stays open
        </span>
      </div>
    </form>
  );
}
