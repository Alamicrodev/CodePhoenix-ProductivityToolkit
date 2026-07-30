import { ReactNode } from "react";

/** Keyboard-shortcut chip: mono, muted, bordered. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground">
      {children}
    </kbd>
  );
}
