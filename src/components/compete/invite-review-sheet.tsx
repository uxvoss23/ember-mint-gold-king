import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { cityRankOf } from "@/lib/upset/city-rank";
import { courtImagesFor } from "@/lib/courts/images";
import type { Court } from "@/lib/courts/types";
import { displayRating } from "@/lib/rating/engine";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

function whenLine(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function streakLabel(streak: number) {
  if (streak > 1) return `${streak}-game win streak`;
  if (streak === 1) return "Won last game";
  if (streak < -1) return `${Math.abs(streak)}-game skid`;
  if (streak === -1) return "Lost last game";
  return "No streak";
}

export function InviteReviewSheet({
  match,
  host,
  me,
  court,
  onClose,
  onAccept,
  onDecline,
  onSendChat,
  onOpenPlayer,
}: {
  match: Match;
  host?: Player;
  me: Player;
  court?: Court | null;
  onClose: () => void;
  onAccept: (bringingBall: boolean) => Promise<void> | void;
  onDecline: () => Promise<void> | void;
  onSendChat: (text: string) => void;
  onOpenPlayer?: (p: Player) => void;
}) {
  const [draft, setDraft] = useState("");
  const [bringing, setBringing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const photo = courtImagesFor(match.courtId, 1)[0];
  const chat = match.chat ?? [];
  const rank = host ? cityRankOf(host.id) : null;
  const format = match.format === "horse" ? "HORSE" : "1v1";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    onSendChat(t);
    setDraft("");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Dismiss"
      />
      <div className="slide-up relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-bg shadow-soft sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-court uppercase">
              Review invite
            </p>
            <h2 className="truncate font-display text-lg font-semibold text-fg">
              {host?.name.split(" ")[0] ?? "Someone"} wants to play
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-fg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
            <div className="relative aspect-[16/7] bg-bg-subtle">
              <img src={photo} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold text-fg">{match.courtName}</p>
              <p className="text-[12px] text-fg-muted">
                {court?.neighborhood ?? "Austin"} · {whenLine(match.preferredAt)} · {format}
              </p>
              {match.notes ? (
                <p className="mt-1 text-[12px] leading-snug text-fg">{match.notes}</p>
              ) : null}
              {match.hostBringingBall != null ? (
                <p className="mt-1 text-[11px] text-fg-subtle">
                  {match.hostBringingBall
                    ? "They’re bringing a basketball."
                    : "They’re not bringing a basketball."}
                </p>
              ) : null}
            </div>
          </div>

          {host ? (
            <button
              type="button"
              onClick={() => onOpenPlayer?.(host)}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-elevated px-3 py-3 text-left"
            >
              <PlayerAvatar player={host} size="lg" className="!size-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{host.name}</p>
                <p className="text-[12px] tabular-nums text-fg-muted">
                  {displayRating(host.rating)}
                  {rank ? ` · City #${rank}` : ""}
                  {" · "}
                  {host.wins}–{host.losses}
                </p>
                <p className="text-[11px] text-fg-subtle">
                  {streakLabel(host.streak)}
                  {host.gamesPlayed ? ` · ${host.gamesPlayed} games` : ""}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-court">Profile</span>
            </button>
          ) : null}

          <p className="mt-4 text-[11px] font-bold tracking-wide text-fg-subtle uppercase">
            Chat before you decide
          </p>
          <div
            ref={listRef}
            className="mt-1.5 max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-border bg-bg-elevated px-3 py-2.5"
          >
            {chat.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-fg-muted">
                Ask about the court, time, or how they play.
              </p>
            ) : (
              chat.map((c) => {
                if (c.system) {
                  return (
                    <p key={c.id} className="text-center text-[11px] text-fg-subtle">
                      {c.text}
                    </p>
                  );
                }
                const mine = c.authorId === me.id || c.authorName === me.name;
                return (
                  <div key={c.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug",
                        mine ? "rounded-br-md bg-court text-white" : "rounded-bl-md bg-bg text-fg",
                      )}
                    >
                      {c.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${host?.name.split(" ")[0] ?? "them"}…`}
              className="min-w-0 flex-1 rounded-full border border-border bg-bg-elevated px-4 py-2.5 text-base outline-none focus:border-court"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              className="rounded-full bg-fg px-3.5 py-2.5 text-[12px] font-semibold text-bg disabled:opacity-40"
            >
              Send
            </button>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-bold text-fg">Are you bringing a basketball?</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setBringing(true)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold",
                  bringing === true
                    ? "border-court bg-court-soft text-fg"
                    : "border-border bg-bg-elevated text-fg-muted",
                )}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setBringing(false)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold",
                  bringing === false
                    ? "border-fg bg-fg text-bg"
                    : "border-border bg-bg-elevated text-fg-muted",
                )}
              >
                No
              </button>
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-[12px] font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={!!busy}
            onClick={async () => {
              setBusy("decline");
              setError(null);
              try {
                await onDecline();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn’t decline.");
                setBusy(null);
              }
            }}
            className="rounded-full border border-border py-3 text-sm font-semibold text-fg disabled:opacity-50"
          >
            {busy === "decline" ? "Declining…" : "Decline"}
          </button>
          <button
            type="button"
            disabled={!!busy || bringing === null}
            onClick={async () => {
              if (bringing === null) {
                setError("Say if you’re bringing a basketball.");
                return;
              }
              setBusy("accept");
              setError(null);
              try {
                await onAccept(bringing);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn’t accept.");
                setBusy(null);
              }
            }}
            className="rounded-full bg-court py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "accept" ? "Accepting…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
