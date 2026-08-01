import { ReactNode } from "react";

/**
 * One settings row — Style Guide §3 Profile/Settings: "label + description on
 * the left, control on the right, grouped in bordered panels split by
 * --border2 … No save button — changes apply instantly."
 *
 * Rows are padding 8px 12px, label 13px/500, description 11.5px --text3.
 */
export function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border2">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {description && <div className="text-[11.5px] text-tertiary">{description}</div>}
      </div>
      {control}
    </div>
  );
}

/** The bordered radius-8 panel the setting rows are grouped into. */
export function SettingPanel({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-border">{children}</div>;
}
