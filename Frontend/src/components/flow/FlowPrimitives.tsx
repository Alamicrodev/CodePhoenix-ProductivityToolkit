import { ReactNode } from "react";

/** Flat bordered stat card: 11px label over an 18px/600 value. */
export function FlowStatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--f-border)] bg-[var(--f-panel)] px-[10px] py-2">
      <div className="text-[11px] text-[var(--f-text3)]">{label}</div>
      <div className="text-[18px] font-semibold">{children}</div>
    </div>
  );
}

/** Caps section label: "ACTIVE · 4" style. */
export function FlowSectionHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`px-1 pb-[6px] pt-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--f-text3)] ${className}`}
    >
      {children}
    </div>
  );
}

interface FlowPanelProps {
  dotColor: string;
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Bordered panel with the standard dot + title + meta header. */
export function FlowPanel({ dotColor, title, meta, right, children, className = "" }: FlowPanelProps) {
  return (
    <div className={`overflow-hidden rounded-[10px] border border-[var(--f-border)] bg-[var(--f-panel)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-[var(--f-border2)] px-3 py-[9px]">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
        <span className="text-[12.5px] font-semibold">{title}</span>
        {meta && <span className="text-[11.5px] text-[var(--f-text3)]">{meta}</span>}
        {right && (
          <>
            <div className="flex-1" />
            {right}
          </>
        )}
      </div>
      {children}
    </div>
  );
}

/** Secondary bordered panel button ("Join", "Edit", "End", "Log out"). */
export function FlowButton({
  children,
  onClick,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-[6px] rounded-md border border-[var(--f-border)] bg-[var(--f-panel)] px-[10px] py-1 text-[12px] text-[var(--f-text2)] hover:bg-[var(--f-hover)] hover:text-[var(--f-text)] ${className}`}
    >
      {children}
    </button>
  );
}

/** Primary accent button with optional kbd chip. */
export function FlowPrimaryButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-[7px] rounded-md border-none bg-[var(--f-accent)] px-[11px] py-[5px] text-[12px] font-medium text-white ${className}`}
    >
      {children}
    </button>
  );
}

interface FlowCheckRowProps {
  done: boolean;
  title: string;
  /** Optional bordered tag with colored text ("Task" / "Habit"). */
  tag?: { label: string; colorVar: string };
  /** Right-aligned trailing content (due label, mono duration…). */
  right?: ReactNode;
  onToggle?: () => void;
  toggleLabel?: string;
  onClick?: () => void;
}

/** Standard dense row: check circle · title · tag · trailing data. */
export function FlowCheckRow({ done, title, tag, right, onToggle, toggleLabel, onClick }: FlowCheckRowProps) {
  return (
    <div
      className={`flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)] ${
        done ? "opacity-[0.62] hover:opacity-85" : ""
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={toggleLabel ?? `${done ? "Reopen" : "Complete"} "${title}"`}
        onClick={onToggle}
        disabled={!onToggle}
        className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full text-[9px] text-white ${
          done
            ? "bg-[var(--f-done)]"
            : "border-[1.5px] border-[var(--f-text3)]"
        } ${onToggle ? "cursor-pointer hover:border-[var(--f-done)]" : "cursor-default"}`}
      >
        {done ? "✓" : ""}
      </button>
      <span
        className={`min-w-0 flex-1 truncate font-medium ${done ? "line-through" : ""} ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      >
        {title}
      </span>
      {tag && (
        <span
          className="whitespace-nowrap rounded border border-[var(--f-border)] px-[6px] py-[1px] text-[11px]"
          style={{ color: `var(${tag.colorVar})` }}
        >
          {tag.label}
        </span>
      )}
      {right}
    </div>
  );
}

interface FlowSegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  small?: boolean;
}

/** Segmented control (List | Matrix, Light | Dark, Mon | Sun). */
export function FlowSegmented<T extends string>({ value, options, onChange, small = false }: FlowSegmentedProps<T>) {
  return (
    <div className="flex gap-[2px] rounded-[7px] border border-[var(--f-border)] bg-[var(--f-panel2)] p-[2px]">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded-[5px] border-none ${small ? "px-[9px] py-[2px] text-[11px]" : "px-3 py-[3px] text-[12px]"} ${
            value === option.value
              ? "bg-[var(--f-panel)] text-[var(--f-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              : "bg-transparent text-[var(--f-text3)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
