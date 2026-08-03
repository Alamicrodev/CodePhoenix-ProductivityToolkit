import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * A button label that swaps for a spinner without the button changing size.
 *
 * Both states are always laid out — stacked in a single grid cell — so the
 * button measures to the wider of the two and the row around it never twitches
 * when a request starts. Swapping the text outright shifted the Focus modal's
 * footer by 49px and nudged its Cancel button sideways mid-click.
 *
 * The button that wraps this should carry `disabled` and `aria-busy`.
 */
export function PendingLabel({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  /** What the button says while the request is in flight — "Ending…". */
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <span className="grid place-items-center">
      <span
        className={`col-start-1 row-start-1 flex items-center gap-1.5 ${pending ? "invisible" : ""}`}
        aria-hidden={pending}
      >
        {children}
      </span>
      <span
        className={`col-start-1 row-start-1 flex items-center gap-1.5 ${pending ? "" : "invisible"}`}
        aria-hidden={!pending}
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        {pendingLabel}
      </span>
    </span>
  );
}
