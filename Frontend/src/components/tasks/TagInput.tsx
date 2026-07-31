import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useData } from "../../context/DataContext";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, "").toLowerCase();
}

/**
 * Chip-style tag editor: Enter/comma adds, Backspace on an empty field removes
 * the last chip. Suggestions are aggregated client-side from existing tasks.
 */
export function TagInput({ tags, onChange }: TagInputProps) {
  const { tasks } = useData();
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(() => {
    const all = new Set<string>();
    tasks.forEach(task => task.tags.forEach(tag => all.add(tag)));
    tags.forEach(tag => all.delete(tag));
    const query = normalizeTag(draft);
    return [...all]
      .filter(tag => !query || tag.includes(query))
      .sort()
      .slice(0, 6);
  }, [tasks, tags, draft]);

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setDraft("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-input-background px-2 py-1.5">
        {tags.map(tag => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded border border-border bg-card px-1.5 py-px text-xs text-muted-foreground"
          >
            #{tag}
            <button
              type="button"
              aria-label={`Remove tag: ${tag}`}
              onClick={() => onChange(tags.filter(t => t !== tag))}
              className="rounded hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Add tags…" : ""}
          aria-label="Add tag"
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-tertiary"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {suggestions.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-full border border-border bg-card px-2 py-px text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
