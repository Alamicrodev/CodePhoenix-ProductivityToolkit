import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import { ApiCoworkSession, coworkApi } from "../lib/coworkApi";
import { FlowShell } from "../components/flow/FlowShell";
import { FlowButton, FlowPrimaryButton, FlowSectionHeader } from "../components/flow/FlowPrimitives";
import { QuickAdd } from "../components/flow/QuickAdd";
import { KbdChip } from "../components/flow/KbdChip";
import { userInitials } from "../lib/flowTasks";
import { formatClock12 } from "../lib/flowFormat";

function liveDuration(createdAt: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export default function CoworkPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ApiCoworkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    if (!accessToken) return;
    try {
      setSessions(await coworkApi.list(accessToken));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load your cowork rooms."));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const liveRooms = useMemo(() => sessions.filter(session => session.status === "open"), [sessions]);
  const peopleFocusing = useMemo(
    () => liveRooms.reduce((sum, room) => sum + room.participant_count, 0),
    [liveRooms],
  );

  const focusQuickAdd = useCallback(() => {
    window.setTimeout(() => quickAddRef.current?.focus(), 30);
  }, []);

  const handleQuickAdd = useCallback(async () => {
    if (!accessToken) return;
    // Room names are free text — "until 5pm" style suffixes are part of the name.
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    try {
      const created = await coworkApi.create(accessToken, title);
      navigate(`/cowork/${created.slug}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create the room."));
    }
  }, [accessToken, draft, navigate]);

  const handleEnd = useCallback(
    async (slug: string) => {
      if (!accessToken) return;
      try {
        await coworkApi.end(accessToken, slug);
        setSessions(current => current.filter(session => session.slug !== slug));
        toast.success("Room ended.");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Could not end the room."));
      }
    },
    [accessToken],
  );

  const joinFocusedRoom = useCallback(() => {
    const room = liveRooms.find(entry => entry.slug === focusedSlug) ?? liveRooms[0];
    if (room) navigate(`/cowork/${room.slug}`);
  }, [focusedSlug, liveRooms, navigate]);

  const shortcuts = useMemo(
    () => ({ c: focusQuickAdd, j: joinFocusedRoom }),
    [focusQuickAdd, joinFocusedRoom],
  );

  return (
    <FlowShell
      title="Cowork"
      meta={`${liveRooms.length} room${liveRooms.length === 1 ? "" : "s"} live · ${peopleFocusing} ${peopleFocusing === 1 ? "person" : "people"} focusing`}
      shortcuts={shortcuts}
      footerHints={[
        { keys: "C", label: "new room" },
        { keys: "J", label: "join focused room" },
        { keys: "⌘K", label: "commands" },
        { keys: "G", label: "then D/H/F/C/S/P go to module" },
        { keys: "T", label: "theme" },
      ]}
      actions={
        <FlowPrimaryButton onClick={focusQuickAdd}>
          <span>New room</span>
          <KbdChip onAccent>C</KbdChip>
        </FlowPrimaryButton>
      }
    >
      <div className="mx-auto w-full max-w-[840px] px-4 pb-10 pt-[14px]">
        <QuickAdd
          ref={quickAddRef}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => void handleQuickAdd()}
          placeholder={'Start a room…  try "deep work until 5pm"'}
          hint="↵ to start · J joins focused room"
        />

        <FlowSectionHeader>Live · {liveRooms.length}</FlowSectionHeader>
        <div className="flex flex-col">
          {liveRooms.map(room => (
            <div
              key={room.id}
              onMouseEnter={() => setFocusedSlug(room.slug)}
              className={`flex items-center gap-[10px] rounded-md px-2 py-[6px] hover:bg-[var(--f-hover)] ${
                focusedSlug === room.slug ? "bg-[var(--f-hover)]" : ""
              }`}
            >
              {/* Overlapping avatars: host + participant overflow */}
              <div className="flex shrink-0">
                <div
                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[var(--f-panel)] text-[10px] font-semibold ${
                    room.is_host
                      ? "bg-[var(--f-accent-soft)] text-[var(--f-accent)]"
                      : "bg-[var(--f-panel2)] text-[var(--f-text2)]"
                  }`}
                >
                  {userInitials(room.host_name)}
                </div>
                {room.participant_count > 1 && (
                  <div className="-ml-[7px] flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[var(--f-panel)] bg-[var(--f-panel2)] text-[10px] font-semibold text-[var(--f-text2)]">
                    +{room.participant_count - 1}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{room.title}</div>
                <div className="text-[11.5px] text-[var(--f-text3)]">
                  {room.is_host ? "Hosted by you" : `Hosted by ${room.host_name}`} · expires{" "}
                  {formatClock12(new Date(room.expires_at))}
                </div>
              </div>
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--f-done)]" />
              <span className="whitespace-nowrap text-[12px] text-[var(--f-text3)]">
                Live · {liveDuration(room.created_at)}
              </span>
              <FlowButton onClick={() => navigate(`/cowork/${room.slug}`)}>Join</FlowButton>
              {room.is_host && (
                <FlowButton onClick={() => void handleEnd(room.slug)} className="text-[var(--f-hi)] hover:text-[var(--f-hi)]">
                  End
                </FlowButton>
              )}
            </div>
          ))}
          {!isLoading && liveRooms.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">
              No rooms live — press C to start one.
            </div>
          )}
          {isLoading && (
            <div className="px-2 py-3 text-[12px] text-[var(--f-text3)]">Loading rooms…</div>
          )}
        </div>
      </div>
    </FlowShell>
  );
}
