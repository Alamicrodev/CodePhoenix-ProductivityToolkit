import { Task } from "../../context/DataContext";
import { formatBlockDuration, PlanStats } from "../../lib/schedulePlan";
import { CircleCheckbox } from "../tasks/CircleCheckbox";
import { PriorityBars } from "../tasks/PriorityBars";

interface ScheduleRailProps {
  stats: PlanStats;
  overdueRows: Array<{ task: Task; dateLabel: string }>;
  dueTodayRows: Array<{ task: Task; timeLabel: string }>;
  weekRows: Array<{ task: Task; dateLabel: string }>;
  onCompleteTask: (task: Task) => void;
}

function SectionHeader({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "danger" }) {
  return (
    <h2
      className={`px-0.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${
        tone === "danger" ? "text-priority-high" : "text-tertiary"
      }`}
    >
      {children}
    </h2>
  );
}

/** Right rail: always reflects today — stats grid, overdue, due today, this week. */
export function ScheduleRail({
  stats,
  overdueRows,
  dueTodayRows,
  weekRows,
  onCompleteTask,
}: ScheduleRailProps) {
  const cells = [
    { label: "Planned", value: formatBlockDuration(stats.plannedMin) },
    { label: "Focus", value: formatBlockDuration(stats.focusMin) },
    { label: "Done", value: `${stats.doneCount}/${stats.totalCount}` },
    { label: "Due today", value: String(dueTodayRows.length) },
  ];

  return (
    <aside className="hidden w-[264px] shrink-0 overflow-y-auto border-l border-border px-3.5 py-4 lg:block">
      <SectionHeader>Today</SectionHeader>
      <div className="grid grid-cols-2 gap-[7px]">
        {cells.map(cell => (
          <div key={cell.label} className="rounded-lg border border-border bg-muted px-2.5 py-2">
            <div className="font-mono text-sm font-semibold">{cell.value}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-tertiary">
              {cell.label}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-[18px]">
        <SectionHeader tone="danger">Overdue · {overdueRows.length}</SectionHeader>
        {overdueRows.length === 0 && (
          <p className="px-0.5 py-1 text-[11.5px] text-tertiary">Nothing overdue ✓</p>
        )}
        <div className="flex flex-col">
          {overdueRows.map(({ task, dateLabel }) => (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-md px-1 py-[5px] hover:bg-accent/50"
            >
              <CircleCheckbox
                checked={false}
                onToggle={() => onCompleteTask(task)}
                label={`Mark ${task.title} done`}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{task.title}</span>
              <span className="whitespace-nowrap text-[11px] text-priority-high">{dateLabel}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <SectionHeader>Due today · {dueTodayRows.length}</SectionHeader>
        {dueTodayRows.length === 0 && (
          <p className="px-0.5 py-1 text-[11.5px] text-tertiary">All clear ✓</p>
        )}
        <div className="flex flex-col">
          {dueTodayRows.map(({ task, timeLabel }) => (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-md px-1 py-[5px] hover:bg-accent/50"
            >
              <CircleCheckbox
                checked={false}
                onToggle={() => onCompleteTask(task)}
                label={`Mark ${task.title} done`}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{task.title}</span>
              <span className="whitespace-nowrap font-mono text-[10.5px] text-tertiary">
                {timeLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <SectionHeader>This week</SectionHeader>
        {weekRows.length === 0 && (
          <p className="px-0.5 py-1 text-[11.5px] text-tertiary">Nothing scheduled</p>
        )}
        <div className="flex flex-col">
          {weekRows.map(({ task, dateLabel }) => (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-md px-1 py-[5px] hover:bg-accent/50"
            >
              <PriorityBars priority={task.priority} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{task.title}</span>
              <span className="whitespace-nowrap text-[11px] text-tertiary">{dateLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
