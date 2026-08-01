import { ReactNode } from "react";
import { cn } from "../ui/utils";

/**
 * Keyboard-shortcut chip — the single implementation for the whole app.
 *
 * Style Guide §2: "mono 10px, background var(--kbd-bg), border 1px
 * var(--kbd-border), radius 4, padding 1px 5px, color var(--text3)".
 *
 * `tone="onPrimary"` is the variant that sits on an accent fill, where the
 * guide specifies a white wash instead of the plate:
 * "mono 10px on rgba(255,255,255,0.18), radius 4, padding 1px 5px".
 */
export function Kbd({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "onPrimary";
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "rounded-sm px-[5px] py-px font-mono text-[10px] leading-4",
        tone === "onPrimary"
          ? "bg-white/[0.18] text-primary-foreground"
          : "border border-kbd-border bg-kbd-bg text-tertiary",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
