import { ReactNode } from "react";

interface StatusBannerProps {
  icon: ReactNode;
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}

/**
 * Room status as a designed row rather than a tinted alert box. Every state
 * carries its own icon, so none of them rely on colour alone to be read.
 */
export function StatusBanner({ icon, children, action }: StatusBannerProps) {
  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-[7px] sm:mx-4"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 text-xs">{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Small spinner ring matching the banner's icon slot. */
export function BannerSpinner() {
  return (
    <span
      className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-border border-t-muted-foreground"
      aria-hidden="true"
    />
  );
}
