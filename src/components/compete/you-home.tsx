import { Crown } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { GUEST_PLAYER_ID } from "@/lib/game/guest";
import { cityRankOf } from "@/lib/upset/city-rank";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen } from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

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
