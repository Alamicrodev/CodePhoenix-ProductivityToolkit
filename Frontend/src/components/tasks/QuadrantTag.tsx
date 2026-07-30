import { Task } from "../../context/DataContext";

type Quadrant = NonNullable<Task["quadrant"]>;

const QUADRANT_META: Record<Quadrant, { label: string; className: string }> = {
  "urgent-important": { label: "Do first", className: "text-priority-high" },
  "not-urgent-important": { label: "Schedule", className: "text-primary" },
  "urgent-not-important": { label: "Delegate", className: "text-priority-medium" },
  "not-urgent-not-important": { label: "Eliminate", className: "text-tertiary" },
};

export function QuadrantTag({ quadrant }: { quadrant: Task["quadrant"] }) {
  if (!quadrant) {
    return null;
  }
  const meta = QUADRANT_META[quadrant];

  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded border border-border px-1.5 py-px text-[11px] ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
