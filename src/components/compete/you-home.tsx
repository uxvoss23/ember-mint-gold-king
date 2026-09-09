import { useState } from "react";
import { Crown, MessageSquare } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { GUEST_PLAYER_ID } from "@/lib/game/guest";
import { cityRankOf } from "@/lib/upset/city-rank";
import { displayRating } from "@/lib/rating/engine";
import { applyFriendsAndDms, formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { DirectThread, Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";
import { isProfileComplete, isUnderagePlayer, UNDERAGE_PLAY_MESSAGE } from "@/lib/game/profile";
import { sendDmFn } from "@/lib/game/dm-fns";
import { mutationError } from "@/lib/game/client-actions";

export function YouHome({
  me,
  signedIn,
  matches,
  players,
  onOpenProfile,
  onOpenMatch,
  onGoPlay,
}: {
  me: Player;
  signedIn: boolean;
  matches: Match[];
  players: Player[];
  onOpenProfile: () => void;
  onOpenMatch: (id: string) => void;
  onGoPlay: () => void;
}) {
  if (!signedIn || me.id === GUEST_PLAYER_ID) return null;

  const rank = cityRankOf(me.id);
  const isKing = rank === 1;
  const playerById = (id: string) => players.find((p) => p.id === id);

  const mine = matches.filter(
    (m) => m.hostId === me.id || m.opponentId === me.id,
  );
  const upcoming = mine
    .filter(
      (m) =>
        m.status === "open" ||
        m.status === "scheduled" ||
        m.status === "matched" ||
        m.status === "played_pending",
    )
    .sort((a, b) =>
      (a.scheduledAt ?? a.preferredAt).localeCompare(
        b.scheduledAt ?? b.preferredAt,
      ),
    )
    .slice(0, 4);
  const recent = mine
    .filter((m) => m.status === "confirmed" && m.scores?.length)
    .sort((a, b) =>
      (b.scheduledAt ?? b.preferredAt).localeCompare(
        a.scheduledAt ?? a.preferredAt,
      ),
    )
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-elevated p-4 text-left"
      >
        <PlayerAvatar player={me} size="lg" showElite />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-base font-semibold text-fg">
            {me.name}
            {isKing ? <Crown className="size-4 shrink-0 text-gold" /> : null}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-fg-muted">
            {rank ? `#${rank} Austin` : "Unranked"}
            {" · "}
            {displayRating(me.rating)}
          </p>
          <p className="text-[12px] tabular-nums text-fg-subtle">
            {me.wins}W–{me.losses}L
            {me.streak > 0 ? ` · ${me.streak} streak` : ""}
            {me.gamesPlayed ? ` · ${me.gamesPlayed} rated` : ""}
          </p>
        </div>
      </button>

      {signedIn && isUnderagePlayer(me) ? (
        <div className="w-full rounded-2xl border border-border bg-bg-elevated px-4 py-3 text-left">
          <p className="text-sm font-semibold text-fg">Not eligible to play yet</p>
          <p className="mt-0.5 text-xs text-fg-muted">{UNDERAGE_PLAY_MESSAGE}</p>
        </div>
      ) : signedIn && !isProfileComplete(me) ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full rounded-2xl border border-court/40 bg-court/10 px-4 py-3 text-left"
        >
          <p className="text-sm font-semibold text-fg">Finish your profile</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Age, weight, gender, and ethnicity are required before you can post
            or join a 1v1.
          </p>
        </button>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["Rating", String(displayRating(me.rating))],
            ["Record", `${me.wins}–${me.losses}`],
            ["Streak", me.streak > 0 ? `${me.streak}W` : "—"],
          ] as const
        ).map(([l, v]) => (
          <div
            key={l}
            className="rounded-xl border border-border bg-bg-elevated px-2 py-2.5 text-center"
          >
            <p className="text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
              {l}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-fg">{v}</p>
          </div>
        ))}
      </div>

      <MessagesCard me={me} players={players} />

      <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
            Upcoming
          </p>
          <button
            type="button"
            onClick={onGoPlay}
            className="text-[11px] font-semibold text-court"
          >
            Find a game
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-[12px] text-fg-muted">
            No locked-in games. Post or join a 1v1 on Play.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {upcoming.map((m) => {
              const oppId = m.hostId === me.id ? m.opponentId : m.hostId;
              const opp = oppId ? playerById(oppId) : null;
              const when = formatLocalWhen(m.scheduledAt ?? m.preferredAt);
              const label =
                m.status === "open"
                  ? "Open"
                  : m.status === "played_pending"
                    ? "Score pending"
                    : "Scheduled";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onOpenMatch(m.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-fg">
                        {m.courtName}
                      </p>
                      <p className="truncate text-[11px] text-fg-muted">
                        {opp ? `vs ${opp.name}` : "Waiting for opponent"}
                        {" · "}
                        {when}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold tracking-wide text-court uppercase">
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
        <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
          Recent results
        </p>
        {recent.length === 0 ? (
          <p className="mt-2 text-[12px] text-fg-muted">
            Confirmed 1v1s show here after dual-confirm.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {recent.map((m) => {
              const hostIsMe = m.hostId === me.id;
              const oppId = hostIsMe ? m.opponentId : m.hostId;
              const opp = oppId ? playerById(oppId) : null;
              const delta = hostIsMe ? m.ratingDeltaHost : m.ratingDeltaOpp;
              const score = (m.scores ?? [])
                .map((g) => (hostIsMe ? `${g.a}–${g.b}` : `${g.b}–${g.a}`))
                .join(", ");
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onOpenMatch(m.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-fg">
                        vs {opp?.name ?? "Opponent"}
                      </p>
                      <p className="truncate text-[11px] tabular-nums text-fg-muted">
                        {score}
                        {" · "}
                        {m.courtName}
                      </p>
                    </div>
                    {delta != null ? (
                      <span
                        className={cn(
                          "shrink-0 text-[12px] font-bold tabular-nums",
                          delta >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {delta >= 0 ? "+" : ""}
                        {Math.round(delta)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function MessagesCard({ me, players }: { me: Player; players: Player[] }) {
  const store = useUpsetStore();
  const threads = store.dmThreads ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = threads.find((t) => t.id === openId) ?? null;
  const otherOf = (t: DirectThread) => {
    const oid = t.participantIds.find((id) => id !== me.id);
    return players.find((p) => p.id === oid) ?? null;
  };

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
      <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
        Messages
      </p>
      {threads.length === 0 ? (
        <p className="mt-2 text-[12px] text-fg-muted">
          DMs from player profiles show up here.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {threads.map((t) => {
            const other = otherOf(t);
            const last = t.messages[t.messages.length - 1];
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left"
                >
                  {other ? <PlayerAvatar player={other} size="sm" /> : (
                    <MessageSquare className="size-4 text-fg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-fg">
                      {other?.name ?? "Player"}
                    </p>
                    <p className="truncate text-[11px] text-fg-muted">
                      {last?.text ?? "No messages yet"}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open ? (
        <DmSheet
          me={me}
          other={otherOf(open)}
          thread={open}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}

function DmSheet({
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

