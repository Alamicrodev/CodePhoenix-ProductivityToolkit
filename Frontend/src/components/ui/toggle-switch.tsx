import { cn } from "./utils";

/**
 * Settings toggle — Style Guide §3 Profile/Settings: "Toggles 30×17".
 *
 * The vendored Radix switch is 32×18.4 with a 16px thumb and has never been
 * imported anywhere; this is the spec'd size with a 13px knob inset 2px.
 * No transition — interactions are instant.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name; the visible label lives in the setting row. */
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[17px] w-[30px] shrink-0 rounded-[10px] outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        checked ? "bg-primary" : "bg-switch-background",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white",
          checked ? "right-[2px]" : "left-[2px]",
        )}
      />
    </button>
  );
}
