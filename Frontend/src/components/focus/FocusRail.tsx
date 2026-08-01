import { ReactNode, useMemo } from "react";

import { FocusSession } from "../../context/DataContext";
import { formatMinutes, formatTimerDigits } from "../../lib/focusPlan";
import { startOfWeek } from "../../lib/habitSchedule";

interface FocusRailProps {
  sessions: FocusSession[];
  current: FocusSession | null;
  /** Segment counts for the running session, so the rail agrees with the strip. */
  blocksDone: number;
  blocksTotal: number;
  itemsDone: number;
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-0.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
      {children}
    </h2>
  );
}

function StatTiles({ cells }: { cells: Array<{ label: string; value: string }> }) {
  return (
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
  );
}

/** Items the session actually closed itself, which is what "done" counts here. */
function inSessionDone(session: FocusSession) {
  return session.items.filter(item => item.completedInSessionAt).length;
}

/**
 * A finished session reads as one of three things, and the glyph has to carry it
 * without relying on colour: quit, completed having closed nothing, or completed.
 */
function historyStatus(session: FocusSession) {
  if (session.status === "quit") {
    return { glyph: "✕", tone: "text-tertiary", label: "quit" };
  }
  if (session.items.length > 0 && inSessionDone(session) === 0) {
    return { glyph: "✓", tone: "text-done", label: "nothing closed" };
  }
  return { glyph: "✓", tone: "text-done", label: "completed" };
}

/** Right rail: the session or the week in four numbers, then everything before it. */
export function FocusRail({ sessions, current, blocksDone, blocksTotal, itemsDone }: FocusRailProps) {
  const history = useMemo(
    () =>
      sessions
        .filter(session => session.status === "completed" || session.status === "quit")
        .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()),
    [sessions],
  );

  const week = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const inWeek = sessions.filter(session => new Date(session.startedAt) >= weekStart);
    return {
      focused: formatMinutes(inWeek.reduce((sum, session) => sum + session.elapsedSeconds, 0) / 60),
      sessions: String(inWeek.length),
      blocks: String(inWeek.reduce((sum, session) => sum + session.completedFocusBlocks, 0)),
      items: String(inWeek.reduce((sum, session) => sum + inSessionDone(session), 0)),
    };
  }, [sessions]);

  const activeCells = current
    ? [
        { label: "Elapsed", value: formatTimerDigits(current.elapsedSeconds) },
        {
          label: "Remaining",
          value: formatTimerDigits(current.totalDurationMinutes * 60 - current.elapsedSeconds),
        },
        { label: "Blocks done", value: `${blocksDone}/${blocksTotal}` },
        { label: "Items done", value: `${itemsDone}/${current.items.length}` },
      ]
    : null;

  return (
    <aside className="w-full shrink-0 border-t border-border px-3.5 py-4 lg:w-[264px] lg:border-l lg:border-t-0">
      {activeCells ? (
        <>
          <SectionHeader>Session</SectionHeader>
          <StatTiles cells={activeCells} />
        </>
      ) : (
        <>
          <SectionHeader>This week</SectionHeader>
          <StatTiles
            cells={[
              { label: "Focused", value: week.focused },
              { label: "Sessions", value: week.sessions },
              { label: "Blocks", value: week.blocks },
              { label: "Items done", value: week.items },
            ]}
          />
        </>
      )}

      <div className="pt-[18px]">
        <SectionHeader>History</SectionHeader>
        {history.length === 0 ? (
          <p className="px-0.5 py-1 text-[11.5px] text-tertiary">No sessions yet.</p>
        ) : (
          <div className="flex flex-col">
            {history.map(session => {
              const status = historyStatus(session);
              const day = new Date(session.startedAt).toLocaleDateString("en-US", { weekday: "short" });
              const meta = [day, session.status === "quit" ? "quit" : null]
                .filter(Boolean)
                .concat(`${inSessionDone(session)}/${session.items.length} done`)
                .join(" · ");

              return (
                <div
                  key={session.id}
                  className="flex items-center gap-2 rounded-md px-1 py-[5px] hover:bg-accent/50"
                  title={`${session.title} — ${status.label}`}
                >
                  <span className={`shrink-0 text-[11px] leading-none ${status.tone}`} aria-hidden="true">
                    {status.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{session.title}</span>
                    <span className="block truncate text-[11px] text-tertiary">{meta}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-tertiary">
                    {formatMinutes(session.elapsedSeconds / 60)}
                  </span>
                  <span className="sr-only">{status.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
