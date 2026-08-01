import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Check, Copy, Plus, Search, User, Users } from "lucide-react";

import DashboardLayout from "../components/DashboardLayout";
import type { PaletteCommand } from "../components/ModuleCommandPalette";
import { usePalette, useRegisterPaletteCommands } from "../context/PaletteContext";
import { Kbd } from "../components/tasks/Kbd";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import { ApiCoworkSession, buildShareLink, coworkApi } from "../lib/coworkApi";
import { formatExpiresIn } from "../lib/coworkFormat";
import { CMD_LABEL } from "../lib/platform";

/** Overlapping heads for an occupied room; a hollow dot for an empty one. */
function Presence({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="flex w-11 shrink-0 items-center" title="Nobody inside">
        <span className="h-[7px] w-[7px] rounded-full border border-tertiary" aria-hidden="true" />
      </span>
    );
  }

  const heads = Math.min(count, 3);
  return (
    <span className="flex w-11 shrink-0 items-center" title={`${count} inside`}>
      {Array.from({ length: heads }, (_, index) => (
        <span
          key={index}
          style={{ marginLeft: index === 0 ? 0 : -7 }}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-muted ring-2 ring-background"
          aria-hidden="true"
        >
          <User className="h-3 w-3 text-tertiary" />
        </span>
      ))}
      {count > 3 && (
        <span
          style={{ marginLeft: -7 }}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-muted font-mono text-[9px] text-tertiary ring-2 ring-background"
          aria-hidden="true"
        >
          +{count - 3}
        </span>
      )}
    </span>
  );
}

export default function CoworkPage() {
  const { accessToken } = useAuth();
  const [rooms, setRooms] = useState<ApiCoworkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [confirmEndSlug, setConfirmEndSlug] = useState<string | null>(null);
  // ⌘K and the palette live in the shell; this page only needs to know the
  // palette is open so its own single-letter keys stay suppressed under it.
  const { open: isPaletteOpen, setOpen: setIsPaletteOpen } = usePalette();
  // A room being named. It exists on screen before it exists on the server —
  // committing the name is what creates it.
  const [draftName, setDraftName] = useState<string | null>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const isCommittingRef = useRef(false);

  const loadRooms = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    try {
      setRooms(await coworkApi.list(accessToken));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load your cowork rooms."));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const copyLink = useCallback(async (slug: string, quiet = false) => {
    try {
      await navigator.clipboard.writeText(buildShareLink(slug));
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug(current => (current === slug ? null : current)), 2000);
      return true;
    } catch {
      // Clipboard access needs a secure context; the link is on screen anyway.
      if (!quiet) {
        toast.error("Could not copy automatically — select the link and copy it.");
      }
      return false;
    }
  }, []);

  const startDraft = useCallback(() => {
    setDraftName("");
    window.setTimeout(() => draftRef.current?.focus(), 0);
  }, []);

  const commitDraft = async () => {
    if (draftName === null || isCommittingRef.current || !accessToken) {
      return;
    }
    isCommittingRef.current = true;
    const title = draftName.trim();
    setDraftName(null);
    try {
      const created = await coworkApi.create(accessToken, title || undefined);
      setRooms(current => [created, ...current]);
      const copied = await copyLink(created.slug, true);
      toast.success(copied ? "Room created — link copied" : "Room created");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create the room."));
    } finally {
      isCommittingRef.current = false;
    }
  };

  const endRoom = async (slug: string) => {
    if (!accessToken) {
      return;
    }
    setConfirmEndSlug(null);
    try {
      await coworkApi.end(accessToken, slug);
      setRooms(current => current.filter(room => room.slug !== slug));
      toast.success("Room ended.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not end the room."));
    }
  };

  // N opens a new room for naming; ⌘K opens the palette.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isPaletteOpen) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      if (isTyping) {
        return;
      }
      if (event.key.toLowerCase() === "n" && draftName === null) {
        event.preventDefault();
        startDraft();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draftName, isPaletteOpen]);

  const liveCount = rooms.filter(room => room.participant_count > 0).length;
  const showEmptyState = !isLoading && rooms.length === 0 && draftName === null;

  const paletteCommands: PaletteCommand[] = useMemo(() => [
    { label: "New room", icon: <Plus />, shortcut: "N", run: startDraft },
    ...rooms.map(room => ({
      label: `Copy link — ${room.title}`,
      icon: <Copy />,
      run: () => void copyLink(room.slug),
    })),
  ], [rooms, startDraft, copyLink]);

  useRegisterPaletteCommands("Cowork", paletteCommands);

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 sm:h-[46px] sm:px-4 sm:py-0">
          <h1 className="text-[13px] font-semibold">Cowork</h1>
          <span className="min-w-0 truncate text-xs text-tertiary">
            {rooms.length} room{rooms.length === 1 ? "" : "s"}
            {liveCount > 0 ? ` · ${liveCount} live` : ""} · links expire after 24h
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            Search or command
            <Kbd>{CMD_LABEL} K</Kbd>
          </button>
          {/* The empty state carries the only primary button when it is showing. */}
          {!showEmptyState && (
            <button
              type="button"
              onClick={startDraft}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              New room
              <Kbd tone="onPrimary">N</Kbd>
            </button>
          )}
        </div>

        <div className="mx-auto w-full max-w-[840px] flex-1 px-4 pb-10 pt-4 sm:px-4">
          {isLoading ? (
            <p className="px-2 py-6 text-xs text-tertiary">Loading rooms…</p>
          ) : showEmptyState ? (
            <div className="mx-auto max-w-[420px] pt-[104px] text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card">
                <Users className="h-4 w-4 text-tertiary" />
              </div>
              <h2 className="mt-3 text-[13.5px] font-semibold">No rooms yet</h2>
              <p className="mx-auto mt-1.5 max-w-[340px] text-[12.5px] leading-relaxed text-tertiary">
                A room is a video space with a shareable link. Anyone with a FlowManager account can join, and
                the link stops working after 24 hours.
              </p>
              <button
                type="button"
                onClick={startDraft}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                New room
                <Kbd tone="onPrimary">N</Kbd>
              </button>
            </div>
          ) : (
            <>
              <h2 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
                Your rooms · {rooms.length + (draftName === null ? 0 : 1)}
              </h2>

              {draftName !== null && (
                <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
                  <Presence count={0} />
                  <input
                    ref={draftRef}
                    value={draftName}
                    onChange={event => setDraftName(event.target.value)}
                    onBlur={() => void commitDraft()}
                    onKeyDown={event => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void commitDraft();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setDraftName(null);
                      }
                    }}
                    placeholder="Room name"
                    aria-label="Name the new room"
                    className="min-w-0 flex-1 rounded-[5px] border border-primary bg-transparent px-1.5 py-0.5 text-[13px] font-medium outline-none placeholder:font-normal placeholder:text-tertiary"
                  />
                  <span className="shrink-0 text-[11.5px] text-tertiary">
                    <Kbd>↵</Kbd> to create
                  </span>
                </div>
              )}

              <div className="flex flex-col">
                {rooms.map(room => {
                  const occupied = room.participant_count > 0;
                  return (
                    <div
                      key={room.id}
                      className="group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-hover"
                    >
                      <Presence count={room.participant_count} />

                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium">{room.title}</span>
                          {occupied && (
                            <span
                              className="h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-done"
                              title="Live now"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="truncate text-[11.5px] text-tertiary">
                          {occupied
                            ? `${room.participant_count} inside`
                            : "Nobody inside yet"}{" "}
                          · expires in {formatExpiresIn(room.expires_at)}
                        </span>
                      </span>

                      <code className="hidden max-w-[210px] shrink-0 truncate font-mono text-[11px] text-tertiary md:block">
                        {buildShareLink(room.slug)}
                      </code>

                      <button
                        type="button"
                        onClick={() => void copyLink(room.slug)}
                        aria-label={`Copy link to ${room.title}`}
                        title="Copy share link"
                        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover hover:text-foreground"
                      >
                        {copiedSlug === room.slug ? (
                          <Check className="h-3.5 w-3.5 text-done" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <Link
                        to={`/cowork/${room.slug}`}
                        className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {occupied ? "Join" : "Open"}
                      </Link>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmEndSlug(current => (current === room.slug ? null : room.slug))}
                          aria-expanded={confirmEndSlug === room.slug}
                          className="rounded-md px-2 py-1 text-xs text-tertiary transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          End
                        </button>
                        {confirmEndSlug === room.slug && (
                          <div
                            role="dialog"
                            aria-label={`End ${room.title}?`}
                            className="absolute right-0 top-full z-20 mt-1.5 w-[248px] rounded-lg border border-border bg-popover p-3 shadow-xl"
                          >
                            <p className="text-[12.5px] leading-relaxed">
                              End this room? The link stops working for everyone.
                            </p>
                            <div className="mt-2.5 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmEndSlug(null)}
                                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void endRoom(room.slug)}
                                className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground transition-opacity hover:opacity-90"
                              >
                                End room
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Shortcut footer */}
        <div className="mt-auto hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-1.5 text-[11px] text-tertiary sm:flex sm:px-4">
          <span className="flex items-center gap-1.5">
            <Kbd>N</Kbd> new room
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>{CMD_LABEL} K</Kbd> commands
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>T</Kbd> theme
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
