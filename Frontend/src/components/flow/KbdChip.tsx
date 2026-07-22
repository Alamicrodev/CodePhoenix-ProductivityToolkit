interface KbdChipProps {
  children: React.ReactNode;
  /** White-alpha variant for use on the accent "New task" button. */
  onAccent?: boolean;
  className?: string;
}

export function KbdChip({ children, onAccent = false, className = "" }: KbdChipProps) {
  return (
    <kbd className={`flow-kbd ${onAccent ? "flow-kbd--accent" : ""} ${className}`}>{children}</kbd>
  );
}
