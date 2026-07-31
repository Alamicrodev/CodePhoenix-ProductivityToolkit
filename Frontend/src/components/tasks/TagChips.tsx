const MAX_VISIBLE = 2;

/** Compact tag chips for dense rows; collapses beyond two into "+n". */
export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return null;
  }
  const visible = tags.slice(0, MAX_VISIBLE);
  const overflow = tags.length - visible.length;

  return (
    <span className="flex shrink-0 items-center gap-1" title={tags.map(t => `#${t}`).join(" ")}>
      {visible.map(tag => (
        <span
          key={tag}
          className="whitespace-nowrap rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground"
        >
          #{tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground">
          +{overflow}
        </span>
      )}
    </span>
  );
}
