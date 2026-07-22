import { forwardRef } from "react";

interface QuickAddProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}

// Always-visible entry row; Enter adds and keeps focus for rapid entry.
export const QuickAdd = forwardRef<HTMLInputElement, QuickAddProps>(function QuickAdd(
  { draft, onDraftChange, onSubmit },
  ref,
) {
  return (
    <div className="mb-[14px] flex items-center gap-[10px] rounded-lg border border-[var(--f-border)] bg-[var(--f-panel)] px-3 py-[7px] focus-within:border-[var(--f-accent)]">
      <span className="text-[15px] leading-none text-[var(--f-accent)]">+</span>
      <input
        ref={ref}
        value={draft}
        onChange={event => onDraftChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") onSubmit();
        }}
        placeholder={'Add a task…  try "pay rent tomorrow !high"'}
        className="flex-1 border-none bg-transparent text-[13px] text-[var(--f-text)] outline-none"
      />
      <span className="hidden font-['Geist_Mono',ui-monospace,monospace] text-[10px] text-[var(--f-text3)] sm:inline">
        ↵ to add · stays open
      </span>
    </div>
  );
});
