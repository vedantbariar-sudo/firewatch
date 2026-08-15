import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CornerDownRight,
  MessageSquare,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { Panel } from "@/components/dashboard/Panel";

type Update = Doc<"incidentUpdates">;

function AuthorBadge({ update }: { update: Update }) {
  if (update.kind === "system") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ShieldCheck className="size-3.5 text-sky-400" />
        FireWatch · System
      </span>
    );
  }
  const name = update.authorName || "Team member";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex items-center gap-2 text-xs font-medium text-foreground">
      <Avatar className="size-5">
        <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
          {initials || "?"}
        </AvatarFallback>
      </Avatar>
      {name}
    </span>
  );
}

interface IncidentLogProps {
  incidentId: string;
}

export function IncidentLog({ incidentId }: IncidentLogProps) {
  const updates = useQuery(api.incidentUpdates.list, { incidentId });
  const postUpdate = useMutation(api.incidentUpdates.post);
  const seedLog = useMutation(api.incidentUpdates.seed);

  const seededRef = useRef(false);
  const [body, setBody] = useState("");
  const [replyToId, setReplyToId] = useState<Id<"incidentUpdates"> | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Seed a few system entries the first time an incident brief is opened.
  useEffect(() => {
    if (updates && updates.length === 0 && !seededRef.current) {
      seededRef.current = true;
      seedLog({ incidentId }).catch(() => {
        seededRef.current = false;
      });
    }
  }, [updates, incidentId, seedLog]);

  const threads = useMemo(() => {
    if (!updates) return null;
    const parents = updates.filter((update) => !update.parentId);
    return parents.map((parent) => ({
      parent,
      comments: updates.filter((update) => update.parentId === parent._id),
    }));
  }, [updates]);

  const submitUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      await postUpdate({ incidentId, body });
      setBody("");
      toast.success("Update posted to the operations log.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post the update.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (parentId: Id<"incidentUpdates">) => {
    if (!replyBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      await postUpdate({ incidentId, body: replyBody, parentId });
      setReplyBody("");
      setReplyToId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post the reply.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel
      title="Operations log"
      icon={<MessageSquare className="size-4 text-sky-400" />}
      right={
        <span className="text-[11px] text-muted-foreground">
          {updates ? `${updates.length} entries` : "…"}
        </span>
      }
      contentClassName="p-0"
    >
      {/* New update */}
      <form
        onSubmit={submitUpdate}
        className="border-b border-border/60 p-4"
      >
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Post an operational update for this incident…"
          rows={2}
          maxLength={2000}
          className="resize-none bg-background/60"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Shared with your team only.
          </p>
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || submitting}
            className="cursor-pointer"
          >
            <Send className="size-3.5" />
            Post update
          </Button>
        </div>
      </form>

      {/* Threads */}
      <ul className="divide-y divide-border/60">
        {threads === null ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading log…
          </li>
        ) : threads.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No updates yet — post the first one above.
          </li>
        ) : (
          threads.map(({ parent, comments }) => (
            <li key={parent._id} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <AuthorBadge update={parent} />
                <span className="text-[11px] text-muted-foreground/70">
                  {timeAgo(parent.createdAt)}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-foreground/90">
                {parent.body}
              </p>
              <button
                type="button"
                onClick={() =>
                  setReplyToId(replyToId === parent._id ? null : parent._id)
                }
                className="mt-1.5 flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <CornerDownRight className="size-3" />
                {comments.length > 0 ? `Reply · ${comments.length}` : "Reply"}
              </button>

              {comments.length > 0 && (
                <ul className="mt-2 space-y-2 border-l border-border/60 pl-3">
                  {comments.map((comment) => (
                    <li key={comment._id} className="rounded-lg bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <AuthorBadge update={comment} />
                        <span className="text-[11px] text-muted-foreground/70">
                          {timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-foreground/85">
                        {comment.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {replyToId === parent._id && (
                <div className="mt-2 flex items-start gap-2">
                  <Textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    maxLength={2000}
                    className="resize-none bg-background/60"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!replyBody.trim() || submitting}
                    onClick={() => submitReply(parent._id)}
                    className="cursor-pointer"
                  >
                    <Send className="size-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}
