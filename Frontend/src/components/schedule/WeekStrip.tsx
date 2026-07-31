export interface WeekDay {
  key: string;
  /** "Mon" */
  label: string;
  /** "27" */
  num: string;
  /** "Mon, Jul 27" */
  title: string;
}

interface WeekStripProps {
  days: WeekDay[];
  activeIndex: number;
  /** Index of the real today, marked so it stays findable from other days. */
  todayIndex: number;
  onPick: (index: number) => void;
}

/** Mon–Sun day pills; every day of the week is viewable, today stays marked. */
export function WeekStrip({ days, activeIndex, todayIndex, onPick }: WeekStripProps) {
  return (
    <div className="flex items-center gap-[5px]">
      {days.map((day, index) => {
        const active = index === activeIndex;
        const isToday = index === todayIndex;
        return (
          <button
            key={day.key}
            type="button"
            title={day.title}
            aria-pressed={active}
            onClick={() => onPick(index)}
            className={`flex items-baseline gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="leading-none">{day.label}</span>
            {/* Baseline-aligned with the label; mono metrics otherwise sit high. */}
            <span
              className={`font-mono text-[10.5px] leading-none ${
                isToday && !active ? "font-medium text-primary opacity-100" : "opacity-65"
              }`}
            >
              {day.num}
            </span>
          </button>
        );
      })}
    </div>
  );
}
