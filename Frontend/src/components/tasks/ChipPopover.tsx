import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MARGIN = 8;
const GAP = 5;

interface ChipPopoverProps {
  /** The chip the menu hangs off. */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  width: number;
  children: ReactNode;
  /** Forwarded so a focus trap can still see the rows. */
  panelRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * A chip menu that renders into document.body rather than the modal.
 *
 * Absolutely-positioned children of a scroll container count toward its
 * scrollable area AND get clipped by it. TaskModal's panel is `overflow-y-auto`
 * with a `max-h`, so an in-flow popover made the whole editor sprout a
 * scrollbar and then cut the menu off at the panel edge — measured at 49px of
 * the due-date menu lost. A portal takes the menu out of that box entirely.
 *
 * Position is recomputed on open and on any scroll or resize, and the menu
 * flips above the chip when there is no room below.
 *
 * Note it stays inside the React tree, so clicks still bubble to TaskModal's
 * handlers — the `onClick={stop}` on the content is what keeps a click on a row
 * from closing the menu that owns it.
 */
export function ChipPopover({ anchorRef, open, width, children, panelRef }: ChipPopoverProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? localRef;

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const height = ref.current?.offsetHeight ?? 0;

      const below = rect.bottom + GAP;
      const fitsBelow = below + height + MARGIN <= window.innerHeight;
      const top = fitsBelow ? below : Math.max(MARGIN, rect.top - GAP - height);
      const left = Math.min(
        Math.max(MARGIN, rect.left),
        Math.max(MARGIN, window.innerWidth - width - MARGIN),
      );
      setPosition({ top, left });
    };

    place();
    // Capture phase so scrolling INSIDE the modal repositions it too.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, ref, width]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width,
        // Above the modal's own z-50.
        zIndex: 60,
        // Hidden for the first paint, before the height is measurable.
        visibility: position ? "visible" : "hidden",
      }}
      className="rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {children}
    </div>,
    document.body,
  );
}
