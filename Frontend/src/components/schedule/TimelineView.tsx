import { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
  CORE_END,
  CORE_START,
  formatBlockDuration,
  formatMinutes,
  formatTimeRange,
  GRID_HEIGHT,
  isInProgress,
  minutesToY,
  ScheduleBlock,
  snapDuration,
  snapToSlot,
  yToMinutes,
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
  /** Commits a resize: set the task's duration estimate to `minutes`. */
  onResizeTask: (block: ScheduleBlock, minutes: number) => void;
}

/** Card height between two clock positions on the piecewise scale. */
const heightFor = (start: number, dur: number) =>
  Math.max(minutesToY(start + dur) - minutesToY(start) - 5, 14);

const hourLabel = (h: number) => {
  const hour = h % 24;
  return hour < 12
    ? `${hour === 0 ? 12 : hour} AM`
    : hour === 12
      ? "12 PM"
      : `${hour - 12} PM`;
};

/** Full-scale rows every core hour; sparse labels in the compressed night. */
const HOUR_ROWS: Array<{ min: number; label: string }> = [
  { min: 0, label: hourLabel(0) },
  { min: 180, label: hourLabel(3) },
  ...Array.from({ length: CORE_END / 60 - CORE_START / 60 + 1 }, (_, i) => {
    const h = CORE_START / 60 + i;
    return { min: h * 60, label: hourLabel(h) };
  }),
  { min: 24 * 60, label: hourLabel(24) },
];

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
  nowMin,
  onToggle,
  onEditTask,
}: {
  block: ScheduleBlock;
  todayKey: string;
  nowMin: number;
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
  const extra = blockExtra(block, todayKey, nowMin);

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
  onResize,
  minutesAtClientY,
}: {
  block: ScheduleBlock;
  nowMin: number;
  isToday: boolean;
  todayKey: string;
  onToggle: (block: ScheduleBlock) => void;
  onEditTask: (block: ScheduleBlock) => void;
  onResize: (block: ScheduleBlock, minutes: number) => void;
  /** Maps a pointer clientY to grid minutes (piecewise-aware). */
  minutesAtClientY: (clientY: number) => number | null;
}) {
  const guard = useDragThenClickGuard();
  const [{ isDragging }, drag] = useDrag({
    type: SCHEDULE_ITEM,
    item: () => dragItemFor(block),
    end: guard.markDragEnd,
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  // Bottom-edge resize: the edge tracks the cursor; committed on pointer-up.
  const [previewDur, setPreviewDur] = useState<number | null>(null);
  const resizing = useRef(false);

  const durFromPointer = (clientY: number) => {
    const end = minutesAtClientY(clientY);
    if (end === null) return previewDur ?? block.dur;
    return snapDuration(end - block.start);
  };

  const onResizeStart = (event: React.PointerEvent) => {
    // preventDefault keeps the browser from starting a native (react-dnd) drag
    // or text selection while the handle is held.
    event.preventDefault();
    event.stopPropagation();
    resizing.current = true;
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events (tests) have no capturable pointer.
    }
    setPreviewDur(block.dur);
  };

  const onResizeMove = (event: React.PointerEvent) => {
    if (!resizing.current) return;
    setPreviewDur(durFromPointer(event.clientY));
  };

  const onResizeEnd = (event: React.PointerEvent) => {
    if (!resizing.current) return;
    const finalDur = durFromPointer(event.clientY);
    resizing.current = false;
    setPreviewDur(null);
    guard.markDragEnd();
    if (finalDur !== block.dur) onResize(block, finalDur);
  };

  const inProgress = isInProgress(block, nowMin, isToday);
  const displayDur = previewDur ?? block.dur;
  const height = heightFor(block.start, displayDur);
  const extra = blockExtra(block, todayKey, nowMin);

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
      className={`group absolute left-[70px] right-2 z-[2] flex cursor-grab items-center gap-2.5 overflow-hidden rounded-lg px-2.5 active:cursor-grabbing ${surface} ${
        block.done ? "opacity-55" : ""
      } ${isDragging ? "opacity-30" : ""} ${previewDur !== null ? "border-primary" : ""}`}
      style={{
        top: minutesToY(block.start),
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
          <span
            className={`shrink-0 font-mono text-[10.5px] ${
              previewDur !== null ? "font-medium text-primary" : "text-tertiary"
            }`}
          >
            {formatBlockDuration(displayDur)}
          </span>
        </div>
        {height >= 44 && (
          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-tertiary">
            <span>{formatTimeRange(block.start, block.start + displayDur)}</span>
            {extra && (
              <>
                <span>·</span>
                <span className={extra.className}>{extra.text}</span>
              </>
            )}
          </div>
        )}
      </div>
      {block.kind === "task" && (
        <div
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          onClick={event => event.stopPropagation()}
          title="Drag to adjust duration"
          className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize touch-none items-end justify-center"
        >
          <span
            className={`mb-[2px] h-[3px] w-8 rounded-full transition-opacity ${
              previewDur !== null ? "bg-primary opacity-100" : "bg-tertiary/60 opacity-0 group-hover:opacity-100"
            }`}
          />
        </div>
      )}
    </div>
  );
}

/** Hour-grid day view: full-scale core hours, compressed night bands, draggable blocks. */
export function TimelineView({
  timed,
  untimed,
  nowMin,
  isToday,
  todayKey,
  onToggle,
  onEditTask,
  onDropSchedule,
  onResizeTask,
}: TimelineViewProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [ghost, setGhost] = useState<{ slot: number; dur: number; title: string } | null>(null);

  const minutesAtClientY = (clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? yToMinutes(clientY - rect.top) : null;
  };

  const slotFromMonitor = (monitor: {
    getSourceClientOffset: () => { y: number } | null;
    getClientOffset: () => { y: number } | null;
  }) => {
    const offset = monitor.getSourceClientOffset() ?? monitor.getClientOffset();
    if (!offset) return null;
    const minutes = minutesAtClientY(offset.y);
    return minutes === null ? null : snapToSlot(minutes);
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
                nowMin={nowMin}
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
        {/* Compressed night bands */}
        <div
          className="pointer-events-none absolute inset-x-0 rounded-md bg-muted/40"
          style={{ top: minutesToY(0), height: minutesToY(CORE_START) - minutesToY(0) }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 rounded-md bg-muted/40"
          style={{ top: minutesToY(CORE_END), height: minutesToY(24 * 60) - minutesToY(CORE_END) }}
        />

        {HOUR_ROWS.map(row => (
          <div
            key={row.min}
            className="pointer-events-none absolute inset-x-0 flex items-center gap-2"
            style={{ top: minutesToY(row.min) }}
          >
            <span className="w-[46px] shrink-0 -translate-y-1/2 text-right font-mono text-[10px] text-tertiary">
              {row.label}
            </span>
            <span className="flex-1 border-t border-border" />
          </div>
        ))}

        {isToday && (
          <div
            className="pointer-events-none absolute inset-x-0 z-[3] flex h-0 items-center"
            style={{ top: minutesToY(nowMin) }}
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
            onResize={onResizeTask}
            minutesAtClientY={minutesAtClientY}
          />
        ))}

        {isOver && ghost && (
          <div
            className="pointer-events-none absolute left-[70px] right-2 z-[4] flex items-center gap-2 overflow-hidden rounded-lg border border-dashed border-primary bg-primary/10 px-2.5"
            style={{
              top: minutesToY(ghost.slot),
              height: heightFor(ghost.slot, ghost.dur),
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
