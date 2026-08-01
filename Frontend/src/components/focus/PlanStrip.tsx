import { PlanSegment, formatMinutes } from "../../lib/focusPlan";

interface PlanStripProps {
  segments: PlanSegment[];
  /**
   * "preview" is the flat sequence shown while setting a session up; "active"
   * colours the same sequence by progress and grows a fill bar in the current
   * block.
   */
  variant?: "preview" | "active";
  /** Index into `segments` of the block running now. -1 when nothing is running. */
  activeIndex?: number;
  /** How far through the current block we are, 0–1. */
  activeFraction?: number;
}

function segmentTitle(segment: PlanSegment, state: "done" | "now" | "todo") {
  const name = segment.kind === "focus" ? "Focus" : "Break";
  const suffix = state === "now" ? " — now" : state === "done" ? " — done" : "";
  return `${name} ${formatMinutes(segment.minutes)}${suffix}`;
}

/**
 * The session's rhythm as proportional bars — dashed for breaks, the same
 * vocabulary the day-planner timeline uses. Shared by the setup preview and the
 * running session so the plan you picked is literally the thing that fills in.
 */
export function PlanStrip({
  segments,
  variant = "preview",
  activeIndex = -1,
  activeFraction = 0,
}: PlanStripProps) {
  const isActive = variant === "active";
  const focusHeight = isActive ? "h-6" : "h-4";
  const breakHeight = isActive ? "h-[13px]" : "h-[9px]";
  const radius = isActive ? "rounded-[5px]" : "rounded-[3px]";

  return (
    <div className={`flex items-center ${isActive ? "gap-[3px]" : "gap-[2px]"}`} aria-hidden="true">
      {segments.map((segment, index) => {
        const state = !isActive || activeIndex < 0
          ? "todo"
          : index < activeIndex
            ? "done"
            : index === activeIndex
              ? "now"
              : "todo";
        const isFocus = segment.kind === "focus";

        let tone = isFocus ? "border border-border bg-muted" : "border border-dashed border-border";
        if (isActive && isFocus && state === "done") {
          tone = "bg-primary/85";
        } else if (isActive && isFocus && state === "now") {
          tone = "border border-primary bg-primary/10";
        } else if (isActive && !isFocus && state !== "todo") {
          tone = "border border-dashed border-tertiary/50";
        }

        return (
          <div
            key={index}
            title={segmentTitle(segment, state)}
            style={{ flexGrow: Math.max(segment.minutes, 1), flexBasis: 0 }}
            className={`relative overflow-hidden ${radius} ${isFocus ? focusHeight : breakHeight} ${tone}`}
          >
            {state === "now" && isFocus && (
              <div
                className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-[400ms] ease-linear"
                style={{ width: `${Math.min(100, Math.max(0, activeFraction * 100))}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
