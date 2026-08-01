import { ReactNode } from "react";
import { Kbd } from "../tasks/Kbd";

/**
 * The shared 30px footer shortcut strip.
 *
 * Style Guide principle 1, Keyboard first: "Module-specific keys stay
 * single-letter and are shown in the footer strip."
 *
 * Items marked `wide` are hidden on small screens, where the strip would
 * otherwise wrap past two lines.
 */
export interface ShortcutHint {
  keys: ReactNode;
  label: string;
  /** Hide below the md breakpoint. Use for secondary, wordy hints. */
  wide?: boolean;
}

export function ShortcutFooter({ items }: { items: ReadonlyArray<ShortcutHint> }) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-1.5 text-[11px] text-tertiary">
      {items.map((item, index) => (
        <span
          key={index}
          className={
            item.wide
              ? "hidden items-center gap-1.5 md:flex"
              : "flex items-center gap-1.5"
          }
        >
          <Kbd>{item.keys}</Kbd> {item.label}
        </span>
      ))}
    </div>
  );
}
