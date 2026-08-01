import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "../../context/DataContext";
import { CMD_LABEL } from "../../lib/platform";
import { ParsedQuickAdd, parseQuickAdd } from "../../lib/quickAdd";

export interface QuickAddHandle {
  focus: () => void;
}

interface QuickAddProps {
  /** ⌘↵ hands the parsed draft off to the full editor instead of quick-adding. */
  onOpenFull: (parsed: ParsedQuickAdd) => void;
  /**
   * Due date applied when the text carries no date token — lets Schedule seed
   * new items onto the day being viewed. An explicit token still wins.
   */
  defaultDueDate?: string | null;
  placeholder?: string;
}

/**
 * Always-visible one-line task capture. Enter creates the task optimistically,
 * clears the field, and keeps focus for rapid consecutive entry.
 */
export const QuickAdd = forwardRef<QuickAddHandle, QuickAddProps>(function QuickAdd(
  { onOpenFull, defaultDueDate = null, placeholder = 'Add a task…  try "pay rent tomorrow !high"' },
  ref,
) {
  const { addTask } = useData();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

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
      durationMinutes: null,
      priority: parsed.priority,
      dueDate: parsed.dueDate ?? defaultDueDate,
      dueTime: null,
      tags: parsed.tags,
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
          onKeyDown={event => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onOpenFull(parseQuickAdd(draft));
              setDraft("");
              return;
            }
            if (event.key === "Escape") {
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          aria-label="Quick add task"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-tertiary"
        />
        <span className="hidden shrink-0 font-mono text-[10px] text-tertiary md:inline">
          ↵ add · {CMD_LABEL}↵ full editor
        </span>
      </div>
    </form>
  );
});
