import { useState } from "react";
import { applyFriendsAndDms } from "@/lib/upset/store";
import { sendDmFn } from "@/lib/game/dm-fns";
import { reportPlayerFn } from "@/lib/game/fns";
import { mutationError } from "@/lib/game/client-actions";
import type { DirectThread, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

export function DmSheet({
  me,
  other,
  thread,
  onClose,
}: {
  me: Player;
  other: Player | null;
  thread: DirectThread;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const targetId = other?.id ?? thread.participantIds.find((id) => id !== me.id);

  const send = async () => {
    if (!targetId || !draft.trim()) return;
    try {
      applyFriendsAndDms(
        await sendDmFn({ data: { targetId, text: draft.trim() } }),
      );
      setDraft("");
      setErr(null);
    } catch (e) {
      setErr(mutationError(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Dismiss"
      />
      <div className="slide-up relative z-10 flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-bg-elevated p-4 shadow-soft sm:rounded-3xl">
        <p className="text-sm font-semibold text-fg">{other?.name ?? "Message"}</p>
        <p className="text-[11px] text-fg-subtle">Direct</p>
        {targetId ? (
          <button
            type="button"
            className="mt-1 self-start text-[11px] font-semibold text-fg-subtle"
            onClick={() => {
              const reason = window.prompt("Why are you reporting this conversation?");
              if (!reason?.trim()) return;
              void reportPlayerFn({
                data: { kind: "message", targetId, reason: reason.trim() },
              }).then(() => setErr("Report filed."));
            }}
          >
            Report conversation
          </button>
        ) : null}
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {thread.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-[13px]",
                m.authorId === me.id
                  ? "ml-auto bg-court text-white"
                  : "bg-bg-subtle text-fg",
              )}
            >
              {m.text}
            </div>
          ))}
        </div>
        {err ? (
          <p className="mt-2 text-center text-[12px] text-danger">{err}</p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message…"
            className="h-11 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
