import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Loader2, Plus, Users, Video, XCircle } from "lucide-react";

import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import { ApiCoworkSession, buildShareLink, coworkApi } from "../lib/coworkApi";

function formatExpiry(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CoworkPage() {
  const { accessToken } = useAuth();
  const [sessions, setSessions] = useState<ApiCoworkSession[]>([]);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!accessToken) {
      return;
    }
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

  const handleCreate = async () => {
    if (!accessToken) {
      return;
    }
    setIsCreating(true);
    try {
      const created = await coworkApi.create(accessToken, title.trim() || undefined);
      setSessions(current => [created, ...current]);
      setTitle("");
      toast.success("Room created. Share the link to invite people.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create the room."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(buildShareLink(slug));
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug(current => (current === slug ? null : current)), 2000);
    } catch {
      // Clipboard access needs a secure context; the link is on screen either way.
      toast.error("Could not copy automatically — select the link and copy it.");
    }
  };

  const handleEnd = async (slug: string) => {
    if (!accessToken) {
      return;
    }
    try {
      await coworkApi.end(accessToken, slug);
      setSessions(current => current.filter(session => session.slug !== slug));
      toast.success("Room ended.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not end the room."));
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Cowork</h1>
          <p className="text-muted-foreground">
            Create a room, share the link, and work alongside other people — you'll see each other's
            cameras and what everyone is working on.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold">Start a room</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="room-title">Room name</Label>
              <Input
                id="room-title"
                placeholder="Morning sprint"
                value={title}
                onChange={event => setTitle(event.target.value)}
                className="h-11"
              />
            </div>
            <Button onClick={handleCreate} disabled={isCreating} className="h-11 gap-2">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create room
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Links expire after 24 hours. Anyone with a FlowManager account and the link can join.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold">Your rooms</h2>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading rooms...
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium mb-1">No rooms yet</p>
              <p className="text-sm text-muted-foreground">
                Create one above and send the link to whoever you want to cowork with.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sessions.map(session => (
                <li key={session.id} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{session.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.participant_count > 0
                          ? `${session.participant_count} inside now`
                          : "Nobody inside yet"}
                        {" · "}
                        Expires {formatExpiry(session.expires_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <Link to={`/cowork/${session.slug}`}>
                          <ExternalLink className="w-4 h-4" />
                          Open
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => handleEnd(session.slug)}
                      >
                        <XCircle className="w-4 h-4" />
                        End
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-accent px-3 py-2 text-xs">
                      {buildShareLink(session.slug)}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={() => handleCopy(session.slug)}
                    >
                      {copiedSlug === session.slug ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copiedSlug === session.slug ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
