export interface WeekDay {
  key: string;
  /** "Mon" */
  label: string;
  /** "27" */
  num: string;
  /** "Mon, Jul 27" */
  title: string;
  past: boolean;
}

interface WeekStripProps {
  days: WeekDay[];
  activeIndex: number;
  onPick: (index: number) => void;
}

/** Mon–Sun day pills; past days are dimmed and non-clickable. */
export function WeekStrip({ days, activeIndex, onPick }: WeekStripProps) {
  return (
    <div className="flex items-center gap-[5px]">
      {days.map((day, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={day.key}
            type="button"
            title={day.past ? `${day.title} (past)` : day.title}
            disabled={day.past}
            aria-pressed={active}
            onClick={() => onPick(index)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            } ${day.past ? "cursor-default opacity-45" : "hover:text-foreground"}`}
          >
            <span>{day.label}</span>
            <span className="font-mono text-[10.5px] opacity-65">{day.num}</span>
          </button>
        );
      })}
    </div>
  );
}
