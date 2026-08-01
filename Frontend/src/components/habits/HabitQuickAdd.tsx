import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "../../context/DataContext";
import { parseHabitQuickAdd } from "../../lib/habitQuickAdd";

export interface HabitQuickAddHandle {
  focus: () => void;
}

/**
 * Always-visible habit capture — Style Guide §2 Inputs: "Every module gets an
 * always-visible quick-add at the top of its list: Enter commits + keeps
 * focus, tokens are parsed inline. No modal creation forms, anywhere."
 *
 * Geometry per the spec: 1px border, radius 8, padding 7px 12px, gap 10px,
 * accent "+" at 15px, example placeholder, right-aligned mono 10px hint.
 */
export const HabitQuickAdd = forwardRef<HabitQuickAddHandle>(function HabitQuickAdd(_props, ref) {
  const { addHabit } = useData();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseHabitQuickAdd(draft);
    if (!parsed.title) {
      return;
    }

    void addHabit({
      title: parsed.title,
      description: "",
      frequency: parsed.frequency,
      activeDays: parsed.activeDays,
      streak: 0,
      lastCompleted: null,
      completedDates: [],
      occurrences: [],
      createdAt: new Date().toISOString(),
    });

    // Enter commits and KEEPS FOCUS, so a run of habits can be typed straight through.
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-[7px] focus-within:border-ring/60">
        <Plus className="h-4 w-4 shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Escape") {
              inputRef.current?.blur();
            }
          }}
          placeholder='Add a habit…  try "meditate 10m every weekday"'
          aria-label="Quick add habit"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-tertiary"
        />
        <span className="hidden shrink-0 font-mono text-[10px] text-tertiary md:inline">
          ↵ · stays open
        </span>
      </div>
    </form>
  );
});
