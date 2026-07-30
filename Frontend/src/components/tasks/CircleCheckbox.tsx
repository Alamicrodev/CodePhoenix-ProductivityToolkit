import { Check } from "lucide-react";

interface CircleCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: "sm" | "md";
}

/** Round Linear-style complete toggle: hollow circle → filled green check. */
export function CircleCheckbox({ checked, onToggle, label, size = "md" }: CircleCheckboxProps) {
  const dimension = size === "md" ? "h-[15px] w-[15px]" : "h-[13px] w-[13px]";
  const iconSize = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
      className={`${dimension} shrink-0 rounded-full border-[1.5px] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        checked
          ? "bg-done border-done text-white"
          : "border-tertiary hover:border-done bg-transparent"
      }`}
    >
      {checked && <Check className={iconSize} strokeWidth={3} />}
    </button>
  );
}
