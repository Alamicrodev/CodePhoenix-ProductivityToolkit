import {
  DAY_END,
  DAY_START,
  formatBlockDuration,
  formatTimeRange,
  GRID_HEIGHT,
  GRID_PAD,
  HOUR_PX,
  isInProgress,
  ScheduleBlock,
} from "../../lib/schedulePlan";
import { CircleCheckbox } from "../tasks/CircleCheckbox";
import { PriorityBars } from "../tasks/PriorityBars";
import { blockExtra, KindGlyph } from "./blockMeta";

interface TimelineViewProps {
  timed: ScheduleBlock[];
  untimed: ScheduleBlock[];
  nowMin: number;
  isToday: boolean;
  todayKey: string;
  onToggle: (block: ScheduleBlock) => void;
  /** Opens the editor for task blocks; habit blocks are not editable here. */
  onEditTask: (block: ScheduleBlock) => void;
}

const topFor = (minutes: number) => ((minutes - DAY_START) / 60) * HOUR_PX + GRID_PAD;

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i);

const hourLabel = (h: number) => (h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);

/** Hour-grid day view: hour rules, live now-line, blocks placed at their scheduled times. */
export function TimelineView({
  timed,
  untimed,
  nowMin,
  isToday,
  todayKey,
  onToggle,
  onEditTask,
}: TimelineViewProps) {
  const showNowLine = isToday && nowMin >= DAY_START && nowMin <= DAY_END;

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 pb-10 pt-4">
      {untimed.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
            No time set · {untimed.length}
          </h2>
          <div className="flex flex-col">
            {untimed.map(block => {
              const extra = blockExtra(block, todayKey);
              return (
                <div
                  key={block.id}
                  onClick={block.kind === "task" ? () => onEditTask(block) : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50 ${
                    block.kind === "task" ? "cursor-pointer" : ""
                  } ${block.done ? "opacity-55" : ""}`}
                >
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
                  <span
                    className={`min-w-0 truncate text-[12.5px] font-medium ${
                      block.done ? "line-through" : ""
                    }`}
                  >
                    {block.title}
                  </span>
                  <span className="flex-1" />
                  {extra && (
                    <span className={`whitespace-nowrap text-[11px] ${extra.className}`}>
                      {extra.text}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative" style={{ height: GRID_HEIGHT }}>
        {HOURS.map(hour => (
          <div
            key={hour}
            className="pointer-events-none absolute inset-x-0 flex items-center gap-2"
            style={{ top: topFor(hour * 60) }}
          >
            <span className="w-[46px] shrink-0 -translate-y-1/2 text-right font-mono text-[10px] text-tertiary">
              {hourLabel(hour)}
            </span>
            <span className="flex-1 border-t border-border" />
          </div>
        ))}

        {showNowLine && (
          <div
            className="pointer-events-none absolute inset-x-0 z-[3] flex h-0 items-center"
            style={{ top: topFor(nowMin) }}
            aria-label="Current time indicator"
          >
            <span className="w-[52px] shrink-0" />
            <span className="ml-[3px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary" />
            <span className="h-[1.5px] flex-1 bg-primary opacity-80" />
          </div>
        )}

        {timed.map(block => {
          const inProgress = isInProgress(block, nowMin, isToday);
          const height = Math.max((block.dur / 60) * HOUR_PX - 5, 14);
          const extra = blockExtra(block, todayKey);

          const surface = inProgress
            ? "border border-primary bg-primary/10"
            : "border border-border bg-card hover:border-tertiary";

          return (
            <div
              key={block.id}
              onClick={block.kind === "task" ? () => onEditTask(block) : undefined}
              className={`absolute left-[70px] right-2 z-[2] flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 ${surface} ${
                block.done ? "opacity-55" : ""
              } ${block.kind === "task" ? "cursor-pointer" : ""}`}
              style={{
                top: topFor(block.start),
                height,
                transition: "top 0.35s ease, opacity 0.3s ease, border-color 0.15s",
              }}
            >
              <CircleCheckbox
                checked={block.done}
                onToggle={() => onToggle(block)}
                label={block.done ? `Reopen ${block.title}` : `Mark ${block.title} done`}
                size="sm"
              />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                <div className="flex min-w-0 items-center gap-[7px]">
                  <KindGlyph kind={block.kind} />
                  <span
                    className={`truncate text-[12.5px] font-medium ${
                      block.done ? "line-through" : ""
                    }`}
                  >
                    {block.title}
                  </span>
                  {inProgress && (
                    <span className="shrink-0 rounded border border-primary px-[5px] text-[9.5px] font-semibold uppercase tracking-[0.05em] text-primary">
                      Now
                    </span>
                  )}
                  <span className="flex-1" />
                  {block.kind === "task" && block.priority && (
                    <PriorityBars priority={block.priority} />
                  )}
                  <span className="shrink-0 font-mono text-[10.5px] text-tertiary">
                    {formatBlockDuration(block.dur)}
                  </span>
                </div>
                {height >= 44 && (
                  <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-tertiary">
                    <span>{formatTimeRange(block.start, block.start + block.dur)}</span>
                    {extra && (
                      <>
                        <span>·</span>
                        <span className={extra.className}>{extra.text}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
