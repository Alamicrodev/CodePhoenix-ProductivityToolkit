import { cn } from "./utils";

/**
 * Segmented control — Style Guide §2 Core components.
 *
 * "well = var(--panel2) + 1px var(--border) + radius 7 + padding 2px + gap 2px.
 *  Active segment: 12px, padding 3px 12px, radius 5, background var(--panel),
 *  color var(--text), box-shadow 0 1px 3px rgba(0,0,0,0.12). Inactive:
 *  color var(--text3). max 3 segments, single letter shortcut (V)."
 *
 * Radius 7 and 5 sit between the token steps, so they are arbitrary values
 * here by design — the segmented control is the one place the guide asks for
 * them. No transition: interactions are instant.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional icon rendered before the label. */
  icon?: React.ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  if (options.length > 3 && import.meta.env.DEV) {
    // The guide caps this at 3; beyond that the spec calls for a select menu.
    console.warn(
      `Segmented "${ariaLabel}" has ${options.length} options; the design system specifies max 3 (use a select beyond that).`,
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-[7px] border border-border bg-muted p-0.5",
        className,
      )}
    >
      {options.map(option => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-[5px] px-3 py-[3px] text-xs",
              isActive
                ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                : "text-tertiary hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
