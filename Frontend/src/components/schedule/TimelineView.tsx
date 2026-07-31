import { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
  DAY_END,
  DAY_START,
  formatBlockDuration,
  formatMinutes,
  formatTimeRange,
  GRID_HEIGHT,
  GRID_PAD,
  HOUR_PX,
  isInProgress,
  minutesFromGridY,
  ScheduleBlock,
  snapToSlot,
} from "../../lib/schedulePlan";
import { CircleCheckbox } from "../tasks/CircleCheckbox";
import { PriorityBars } from "../tasks/PriorityBars";
import { blockExtra, KindGlyph } from "./blockMeta";
import { ScheduleDragItem, SCHEDULE_ITEM } from "./dnd";

interface TimelineViewProps {
  timed: ScheduleBlock[];
  untimed: ScheduleBlock[];
  nowMin: number;
  isToday: boolean;
  todayKey: string;
  onToggle: (block: ScheduleBlock) => void;
  /** Opens the editor for task blocks; habit blocks are not editable here. */
  onEditTask: (block: ScheduleBlock) => void;
  /** Applies a drop: reschedule `item` to start at `minutes` on the viewed day. */
  onDropSchedule: (item: ScheduleDragItem, minutes: number) => void;
}

const topFor = (minutes: number) => ((minutes - DAY_START) / 60) * HOUR_PX + GRID_PAD;

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i);

const hourLabel = (h: number) => (h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);

const dragItemFor = (block: ScheduleBlock): ScheduleDragItem => ({
  kind: block.kind,
  sourceId: block.sourceId,
  dur: block.dur,
  title: block.title,
});

/** Suppresses the click that some browsers fire right after a drag ends. */
function useDragThenClickGuard() {
  const dragEndAt = useRef(0);
  return {
    markDragEnd: () => {
      dragEndAt.current = Date.now();
    },
    clickAllowed: () => Date.now() - dragEndAt.current > 250,
  };
}

function UntimedRow({
  block,
  todayKey,
  onToggle,
  onEditTask,
}: {
  block: ScheduleBlock;
  todayKey: string;
  onToggle: (block: ScheduleBlock) => void;
  onEditTask: (block: ScheduleBlock) => void;
}) {
  const guard = useDragThenClickGuard();
  const [{ isDragging }, drag] = useDrag({
    type: SCHEDULE_ITEM,
    item: () => dragItemFor(block),
    end: guard.markDragEnd,
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });
  const extra = blockExtra(block, todayKey);

  return (
    <div
      ref={node => {
        drag(node);
      }}
      onClick={
        block.kind === "task"
          ? () => guard.clickAllowed() && onEditTask(block)
          : undefined
      }
      title="Drag onto the timeline to set a time"
      className={`flex cursor-grab items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50 active:cursor-grabbing ${
        block.done ? "opacity-55" : ""
      } ${isDragging ? "opacity-40" : ""}`}
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
        <span className={`whitespace-nowrap text-[11px] ${extra.className}`}>{extra.text}</span>
      )}
    </div>
  );
}

function TimelineBlock({
  block,
  nowMin,
  isToday,
  todayKey,
  onToggle,
  onEditTask,
}: {
  block: ScheduleBlock;
  nowMin: number;
  isToday: boolean;
  todayKey: string;
  onToggle: (block: ScheduleBlock) => void;
  onEditTask: (block: ScheduleBlock) => void;
}) {
  const guard = useDragThenClickGuard();
  const [{ isDragging }, drag] = useDrag({
    type: SCHEDULE_ITEM,
    item: () => dragItemFor(block),
    end: guard.markDragEnd,
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  const inProgress = isInProgress(block, nowMin, isToday);
  const height = Math.max((block.dur / 60) * HOUR_PX - 5, 14);
  const extra = blockExtra(block, todayKey);

  const surface = inProgress
    ? "border border-primary bg-primary/10"
    : "border border-border bg-card hover:border-tertiary";

  return (
    <div
      ref={node => {
        drag(node);
      }}
      onClick={
        block.kind === "task"
          ? () => guard.clickAllowed() && onEditTask(block)
          : undefined
      }
      title="Drag to reschedule"
      className={`absolute left-[70px] right-2 z-[2] flex cursor-grab items-center gap-2.5 overflow-hidden rounded-lg px-2.5 active:cursor-grabbing ${surface} ${
        block.done ? "opacity-55" : ""
      } ${isDragging ? "opacity-30" : ""}`}
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
            className={`truncate text-[12.5px] font-medium ${block.done ? "line-through" : ""}`}
          >
            {block.title}
          </span>
          {inProgress && (
            <span className="shrink-0 rounded border border-primary px-[5px] text-[9.5px] font-semibold uppercase tracking-[0.05em] text-primary">
              Now
            </span>
          )}
          <span className="flex-1" />
          {block.kind === "task" && block.priority && <PriorityBars priority={block.priority} />}
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
}

/** Hour-grid day view: hour rules, live now-line, draggable blocks at their scheduled times. */
export function TimelineView({
  timed,
  untimed,
  nowMin,
  isToday,
  todayKey,
  onToggle,
  onEditTask,
  onDropSchedule,
}: TimelineViewProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [ghost, setGhost] = useState<{ slot: number; dur: number; title: string } | null>(null);

  const slotFromMonitor = (monitor: {
    getSourceClientOffset: () => { y: number } | null;
    getClientOffset: () => { y: number } | null;
  }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const offset = monitor.getSourceClientOffset() ?? monitor.getClientOffset();
    if (!rect || !offset) return null;
    return snapToSlot(minutesFromGridY(offset.y - rect.top));
  };

  const [{ isOver }, drop] = useDrop<ScheduleDragItem, void, { isOver: boolean }>({
    accept: SCHEDULE_ITEM,
    hover: (item, monitor) => {
      const slot = slotFromMonitor(monitor);
      if (slot === null) return;
      setGhost(prev =>
        prev?.slot === slot && prev.title === item.title
          ? prev
          : { slot, dur: item.dur, title: item.title },
      );
    },
    drop: (item, monitor) => {
      const slot = slotFromMonitor(monitor);
      if (slot !== null) onDropSchedule(item, slot);
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  });

  const showNowLine = isToday && nowMin >= DAY_START && nowMin <= DAY_END;

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 pb-10 pt-4">
      {untimed.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
            No time set · {untimed.length}
          </h2>
          <div className="flex flex-col">
            {untimed.map(block => (
              <UntimedRow
                key={block.id}
                block={block}
                todayKey={todayKey}
                onToggle={onToggle}
                onEditTask={onEditTask}
              />
            ))}
          </div>
        </div>
      )}

      <div
        ref={node => {
          drop(node);
          canvasRef.current = node;
        }}
        className="relative"
        style={{ height: GRID_HEIGHT }}
      >
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

        {timed.map(block => (
          <TimelineBlock
            key={block.id}
            block={block}
            nowMin={nowMin}
            isToday={isToday}
            todayKey={todayKey}
            onToggle={onToggle}
            onEditTask={onEditTask}
          />
        ))}

        {isOver && ghost && (
          <div
            className="pointer-events-none absolute left-[70px] right-2 z-[4] flex items-center gap-2 overflow-hidden rounded-lg border border-dashed border-primary bg-primary/10 px-2.5"
            style={{
              top: topFor(ghost.slot),
              height: Math.max((ghost.dur / 60) * HOUR_PX - 5, 14),
            }}
          >
            <span className="whitespace-nowrap font-mono text-[10.5px] font-medium text-primary">
              {formatMinutes(ghost.slot, true)}
            </span>
            <span className="truncate text-[11.5px] text-primary">{ghost.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}
