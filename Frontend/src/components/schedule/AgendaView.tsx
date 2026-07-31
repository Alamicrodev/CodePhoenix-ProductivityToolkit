import {
  agendaGroups,
  formatBlockDuration,
  formatMinutes,
  isInProgress,
  ScheduleBlock,
  UNTIMED,
} from "../../lib/schedulePlan";
import { CircleCheckbox } from "../tasks/CircleCheckbox";
import { PriorityBars } from "../tasks/PriorityBars";
import { blockExtra, KindGlyph } from "./blockMeta";

interface AgendaViewProps {
  timed: ScheduleBlock[];
  untimed: ScheduleBlock[];
  nowMin: number;
  isToday: boolean;
  todayKey: string;
  onToggle: (block: ScheduleBlock) => void;
  onEditTask: (block: ScheduleBlock) => void;
}

/** List day view grouped Anytime / Morning / Afternoon / Evening. */
export function AgendaView({
  timed,
  untimed,
  nowMin,
  isToday,
  todayKey,
  onToggle,
  onEditTask,
}: AgendaViewProps) {
  const groups = [
    ...(untimed.length > 0 ? [{ name: "Anytime", rows: untimed }] : []),
    ...agendaGroups(timed),
  ];

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 pb-10 pt-4">
      {groups.map(group => (
        <div key={group.name}>
          <h2 className="px-1 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
            {group.name} · {group.rows.length}
          </h2>
          <div className="flex flex-col">
            {group.rows.map(block => {
              const inProgress = isInProgress(block, nowMin, isToday);
              const extra = blockExtra(block, todayKey, nowMin);
              return (
                <div
                  key={block.id}
                  onClick={block.kind === "task" ? () => onEditTask(block) : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-opacity hover:bg-accent/50 ${
                    block.done ? "opacity-55" : ""
                  } ${block.kind === "task" ? "cursor-pointer" : ""}`}
                >
                  <span
                    className={`w-[58px] shrink-0 font-mono text-[11px] ${
                      inProgress ? "text-primary" : "text-tertiary"
                    }`}
                  >
                    {block.start === UNTIMED ? "—" : formatMinutes(block.start, true)}
                  </span>
                  <CircleCheckbox
                    checked={block.done}
                    onToggle={() => onToggle(block)}
                    label={block.done ? `Reopen ${block.title}` : `Mark ${block.title} done`}
                    size="sm"
                  />
                  {block.kind === "task" && block.priority ? (
                    <PriorityBars priority={block.priority} />
                  ) : (
                    <KindGlyph kind={block.kind} />
                  )}
                  <div className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span
                      className={`truncate text-[13px] font-medium ${
                        block.done ? "line-through" : ""
                      }`}
                    >
                      {block.title}
                    </span>
                    {block.desc && (
                      <span className="truncate text-xs text-tertiary">{block.desc}</span>
                    )}
                  </div>
                  {inProgress && (
                    <span className="shrink-0 rounded border border-primary px-[5px] text-[9.5px] font-semibold uppercase tracking-[0.05em] text-primary">
                      Now
                    </span>
                  )}
                  {extra && (
                    <span className={`whitespace-nowrap text-[11.5px] ${extra.className}`}>
                      {extra.text}
                    </span>
                  )}
                  <span className="w-11 shrink-0 text-right font-mono text-[11px] text-tertiary">
                    {formatBlockDuration(block.dur)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
