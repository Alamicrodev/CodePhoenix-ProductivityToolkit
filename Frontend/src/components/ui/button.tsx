import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

/**
 * The design system's three-button system (Style Guide §2 Core components):
 *
 *   primary    accent fill, #fff text, 12px/500, padding 5px 11px, radius 6,
 *              gap 7px — and it ALWAYS carries its keyboard chip.
 *   secondary  1px --border on --panel, --text2 label, padding 4px 11px.
 *   ghost      no border, transparent, --text2 label, padding 4px 8px.
 *
 * "One primary per view, always with its kbd chip. Everything else is
 * secondary or ghost. No danger buttons — destructive actions confirm via
 * palette." The shadcn `destructive` and `link` variants are deliberately
 * absent; `outline` is kept as an alias for `secondary` so existing call
 * sites keep working.
 *
 * No transition: "Motion: none by default — interactions are instant."
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-[7px] whitespace-nowrap",
    "rounded-md text-xs font-medium leading-5",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground px-[11px] py-[5px] hover:bg-primary/90",
        secondary:
          "border border-border bg-card text-muted-foreground px-[11px] py-1 hover:bg-hover hover:text-foreground",
        ghost: "bg-transparent text-muted-foreground px-2 py-1 hover:bg-hover hover:text-foreground",
        // Alias kept so pre-existing `variant="outline"` call sites resolve to
        // the guide's secondary rather than silently falling back.
        outline:
          "border border-border bg-card text-muted-foreground px-[11px] py-1 hover:bg-hover hover:text-foreground",
      },
      size: {
        // The guide specifies one button size; padding lives on the variant.
        default: "",
        sm: "",
        icon: "size-7 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
      /**
       * Keyboard shortcut rendered as a chip inside the button. The guide
       * requires this on every primary — `<Button kbd="C">New task</Button>`.
       * Ignored when `asChild` is set, since the child owns its own content.
       */
      kbd?: React.ReactNode;
    }
>(({ className, variant, size, asChild = false, kbd, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const isPrimary = variant === "primary" || variant == null;

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {children}
          {kbd != null && (
            <span
              aria-hidden="true"
              className={cn(
                "rounded-sm px-[5px] py-px font-mono text-[10px] leading-4",
                // On an accent fill the chip is a white wash; on a neutral
                // surface it uses the standard kbd plate.
                isPrimary
                  ? "bg-white/[0.18] text-primary-foreground"
                  : "border border-kbd-border bg-kbd-bg text-tertiary",
              )}
            >
              {kbd}
            </span>
          )}
        </>
      )}
    </Comp>
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
