import { PRIORITY_META, Priority } from "../../lib/flowTasks";

interface PriorityBarsProps {
  priority: Priority;
  /** Matrix rows use slightly smaller bars than list rows. */
  compact?: boolean;
}

// Three ascending bars; the number filled reflects the priority level.
export function PriorityBars({ priority, compact = false }: PriorityBarsProps) {
  const meta = PRIORITY_META[priority];
  const width = compact ? 2.5 : 3;
  const heights = compact ? [4, 6.5, 10] : [4, 7, 11];

  return (
    <div
      title={meta.label}
      aria-label={meta.label}
      className="flex shrink-0 items-end gap-[1.5px]"
      style={{ height: heights[2] }}
    >
      {heights.map((height, index) => (
        <div
          key={index}
          className="rounded-[1px]"
          style={{
            width,
            height,
            background: index < meta.bars ? `var(${meta.colorVar})` : "var(--f-border)",
          }}
        />
      ))}
    </div>
  );
}
