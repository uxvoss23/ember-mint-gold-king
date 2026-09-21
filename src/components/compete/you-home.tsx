import { BarChart3, Calendar, ChevronRight, Crown, MessageCircle } from "lucide-react";
import { useState } from "react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { cityRankOf } from "@/lib/upset/city-rank";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen } from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";
import { isProfileComplete, isUnderagePlayer, UNDERAGE_PLAY_MESSAGE } from "@/lib/game/profile";
import { imagesForCourt } from "@/lib/courts/images";
import { useCourtAdmin } from "@/lib/courts/admin-overrides";

export function YouHome({
  me,
  signedIn,
  accountName,
  matches,
  unreadCount,
  upcomingCount,
  onOpenProfile,
  onOpenMatch,
  onOpenMessages,
  onOpenMyGames,
  onOpenStats,
  onFindGame,
  onCreateGame,
}: {
  me: Player;
  signedIn: boolean;
  accountName?: string;
  matches: Match[];
  unreadCount: number;
  upcomingCount: number;
  onOpenProfile: () => void;
  onOpenMatch: (id: string) => void;
  onOpenMessages: () => void;
  onOpenMyGames: () => void;
  onOpenStats: () => void;
  onFindGame: () => void;
  onCreateGame: () => void;
}) {
  const rank = cityRankOf(me.id);
  const isKing = rank === 1;
  const displayName = accountName?.trim() || me.name;
  const overrides = useCourtAdmin((s) => s.overrides);

  if (!signedIn) return null;

  const mine = matches.filter(
    (m) => m.hostId === me.id || m.opponentId === me.id,
  );
  const nextGame = mine
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
    )[0];

  const thumb = nextGame
    ? imagesForCourt(nextGame.courtId, 1, overrides)[0]
    : null;
  const when = nextGame
    ? formatLocalWhen(nextGame.scheduledAt ?? nextGame.preferredAt)
    : "";
  const waiting = nextGame && !nextGame.opponentId;
  const [verifyUrl] = useState(() => {
    try {
      return sessionStorage.getItem("uc-verify-url");
    } catch {
      return null;
    }
  });

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex w-full items-center gap-3.5 text-left"
      >
        <PlayerAvatar player={me} size="lg" showElite className="!size-[4.25rem]" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[22px] font-semibold tracking-tight text-fg">
            {displayName.split(" ")[0]}
            {isKing ? <Crown className="size-4 shrink-0 text-gold" /> : null}
          </p>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {rank ? `#${rank}` : "Unranked"} · Austin
          </p>
          <p className="text-[13px] tabular-nums text-fg-subtle">
            {displayRating(me.rating)} Rating · {me.wins}–{me.losses}
          </p>
          <p className="mt-1.5 inline-flex items-center text-[12px] font-medium text-fg-muted">
            View profile
            <ChevronRight className="size-3.5" />
          </p>
        </div>
      </button>

      {isUnderagePlayer(me) ? (
        <div className="rounded-2xl bg-bg-elevated px-4 py-3">
          <p className="text-sm font-semibold text-fg">Not eligible to play yet</p>
          <p className="mt-0.5 text-xs text-fg-muted">{UNDERAGE_PLAY_MESSAGE}</p>
        </div>
      ) : !isProfileComplete(me) ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full rounded-2xl border border-court/40 bg-court/10 px-4 py-3 text-left"
        >
          <p className="text-sm font-semibold text-fg">Finish your profile</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Required before you can post or join a 1v1.
          </p>
        </button>
      ) : null}

      {verifyUrl ? (
        <a
          href={verifyUrl}
          className="block rounded-2xl border border-court/40 bg-court/10 px-4 py-3"
        >
          <p className="text-sm font-semibold text-fg">Verify your email</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Mail isn’t configured on this preview — tap to confirm this account.
          </p>
        </a>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <DashTile
          icon={MessageCircle}
          title="Messages"
          meta="View & reply"
          badge={unreadCount}
          onClick={onOpenMessages}
        />
        <DashTile
          icon={Calendar}
          title="My Games"
          meta={upcomingCount > 0 ? "Upcoming" : "Games"}
          onClick={onOpenMyGames}
        />
        <DashTile
          icon={BarChart3}
          title="My Stats"
          meta="Rankings"
          onClick={onOpenStats}
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-fg">Up next</p>
          <button
            type="button"
            onClick={onOpenMyGames}
            className="text-[12px] font-semibold text-court"
          >
            View all
          </button>
        </div>
        {nextGame ? (
          <button
            type="button"
            onClick={() => onOpenMatch(nextGame.id)}
            className="flex w-full items-center gap-3 rounded-2xl bg-bg-elevated p-2.5 text-left"
          >
            <div className="size-[4.25rem] shrink-0 overflow-hidden rounded-xl bg-bg-subtle">
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-fg">{nextGame.courtName}</p>
              <p className="truncate text-[12px] text-fg-muted">{when}</p>
              <p className="mt-0.5 truncate text-[12px] text-fg-subtle">
                {waiting
                  ? "Waiting for opponent"
                  : nextGame.status === "played_pending"
                    ? "Score pending"
                    : "Locked in"}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-court px-2.5 py-1 text-[10px] font-bold tracking-wide text-court uppercase">
              {nextGame.status === "open" ? "Open" : nextGame.status === "played_pending" ? "Score" : "Set"}
            </span>
          </button>
        ) : (
          <div className="rounded-2xl bg-bg-elevated px-3.5 py-3.5">
            <p className="text-[13px] font-semibold text-fg">No upcoming games</p>
            <p className="mt-0.5 text-[12px] text-fg-muted">Ready to hoop?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onFindGame}
                className="h-10 rounded-full border border-border text-[12px] font-semibold text-fg"
              >
                Find a Game
              </button>
              <button
                type="button"
                onClick={onCreateGame}
                className="h-10 rounded-full bg-court text-[12px] font-semibold text-white"
              >
                Create Game
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function YouStats({
  me,
  matches,
  players,
  onBack,
  onOpenMatch,
}: {
  me: Player;
  matches: Match[];
  players: Player[];
  onBack: () => void;
  onOpenMatch: (id: string) => void;
}) {
  const rank = cityRankOf(me.id);
  const recent = matches
    .filter(
      (m) =>
        (m.hostId === me.id || m.opponentId === me.id) &&
        m.status === "confirmed" &&
        m.scores?.length,
    )
    .sort((a, b) =>
      (b.scheduledAt ?? b.preferredAt).localeCompare(a.scheduledAt ?? a.preferredAt),
    )
    .slice(0, 8);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-8">
      <div className="flex items-center gap-2 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 px-1 text-[13px] font-medium text-fg-muted"
        >
          ← Me
        </button>
        <h2 className="flex-1 text-center font-display text-[17px] font-semibold text-fg">
          My Stats
        </h2>
        <span className="w-12" aria-hidden />
      </div>
      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-bg-elevated px-2 py-3">
        {(
          [
            [rank ? `#${rank}` : "—", "Rank"],
            [String(displayRating(me.rating)), "Rating"],
            [`${me.wins}–${me.losses}`, "Record"],
            [me.streak > 0 ? `${me.streak}W` : "—", "Streak"],
          ] as const
        ).map(([v, l]) => (
          <div key={l} className="text-center">
            <p className="text-[15px] font-semibold tabular-nums text-fg">{v}</p>
            <p className="mt-0.5 text-[10px] text-fg-muted">{l}</p>
          </div>
        ))}
      </div>
      <p className="mb-2 mt-5 text-[13px] font-semibold text-fg">Recent results</p>
      {recent.length === 0 ? (
        <p className="text-[13px] text-fg-muted">Confirmed 1v1s show here after dual-confirm.</p>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((m) => {
            const hostIsMe = m.hostId === me.id;
            const oppId = hostIsMe ? m.opponentId : m.hostId;
            const opp = players.find((p) => p.id === oppId);
            const delta = hostIsMe ? m.ratingDeltaHost : m.ratingDeltaOpp;
            const score = (m.scores ?? [])
              .map((g) => (hostIsMe ? `${g.a}–${g.b}` : `${g.b}–${g.a}`))
              .join(", ");
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpenMatch(m.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-2xl bg-bg-elevated px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-fg">
                      vs {opp?.name ?? "Opponent"}
                    </p>
                    <p className="truncate text-[11px] tabular-nums text-fg-muted">
                      {score} · {m.courtName}
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
    </div>
  );
}

function DashTile({
  icon: Icon,
  title,
  meta,
  badge,
  onClick,
}: {
  icon: typeof MessageCircle;
  title: string;
  meta: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-2xl bg-bg-elevated px-2.5 py-3 text-left"
    >
      <span className="flex items-center justify-between">
        <Icon className="size-4 text-fg" strokeWidth={1.75} />
        {badge && badge > 0 ? (
          <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-court px-1.5 py-0.5 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : (
          <ChevronRight className="size-3.5 text-fg-subtle" />
        )}
      </span>
      <p className="mt-2 text-[13px] font-semibold text-fg">{title}</p>
      <p className="mt-0.5 truncate text-[11px] text-fg-muted">{meta}</p>
    </button>
  );
}
