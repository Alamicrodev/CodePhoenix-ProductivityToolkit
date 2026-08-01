import { ReactNode } from "react";
import { cn } from "../ui/utils";

/**
 * The shared 46px view header bar.
 *
 * Style Guide type scale: "13px / 600 — View title — header bar titles";
 * spacing: "Page gutter 16px". INSTRUCTIONS-modules.md:10 specifies a "46px
 * header bar replacing every hero title + paragraph".
 *
 * Every module renders exactly one of these. Before it existed each page
 * hand-rolled its own, which is how four of them drifted to 48px and three
 * had none at all.
 */
export function ViewHeader({
  title,
  meta,
  actions,
  leading,
  className,
}: {
  title: ReactNode;
  /** Inline 12px tertiary meta, e.g. "4 active · best streak 12d". */
  meta?: ReactNode;
  /** Right-aligned controls. At most one primary button, per the guide. */
  actions?: ReactNode;
  /**
   * Control rendered before the title, e.g. a back link. Kept OUTSIDE the
   * <h1> so it does not end up in the heading's accessible name.
   */
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 sm:h-[46px] sm:py-0",
        className,
      )}
    >
      {leading}
      <h1 className="shrink-0 text-[13px] font-semibold">{title}</h1>
      {meta ? <span className="truncate text-xs text-tertiary">{meta}</span> : null}
      <span className="flex-1" />
      {actions}
    </div>
  );
}
