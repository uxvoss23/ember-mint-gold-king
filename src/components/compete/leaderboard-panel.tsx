import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { displayRating } from "@/lib/rating/engine";
import type { Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

type MainTab = "rankings" | "stats";
type RankingSub = "alltime" | "weekly" | "hottest";
type StatsSub = "most_wins" | "win_pct" | "longest_streak";

interface LeaderboardPanelProps {
  players: Player[];
  meId: string;
  onOpenPlayer: (p: Player) => void;
  onOpenProfile?: () => void;
}

const STAT_CHIPS: { id: StatsSub; label: string }[] = [
  { id: "most_wins", label: "Wins" },
  { id: "win_pct", label: "Win %" },
  { id: "longest_streak", label: "Longest streak" },
];

function MoveDelta({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success">
        <ArrowUp className="size-3" strokeWidth={2.5} />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-danger">
        <ArrowDown className="size-3" strokeWidth={2.5} />
        {Math.abs(delta)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] text-fg-subtle">
      <Minus className="size-3" />
    </span>
  );
}

function sortByStat(list: Player[], sub: StatsSub): Player[] {
  return [...list].sort((a, b) => {
    switch (sub) {
      case "most_wins":
        return b.wins - a.wins || b.rating - a.rating;
      case "win_pct": {
        const pa = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
        const pb = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
        return pb - pa || b.wins - a.wins;
      }
      case "longest_streak": {
        const sa = Math.max(0, Number(a.streak) || 0);
        const sb = Math.max(0, Number(b.streak) || 0);
        return sb - sa || b.wins - a.wins;
      }
      default:
        return b.rating - a.rating;
    }
  });
}

function formatStat(p: Player, sub: StatsSub): string {
  const g = p.wins + p.losses || 1;
  switch (sub) {
    case "most_wins":
      return String(p.wins);
    case "win_pct":
      return `${Math.round((p.wins / g) * 100)}%`;
    case "longest_streak": {
      const s = Math.max(0, Number(p.streak) || 0);
      return s > 0 ? `${s}W` : "—";
    }
    default:
      return String(displayRating(p.rating));
  }
}

/** Compact city 1v1 ladder. */
export function LeaderboardPanel({
  players,
  meId,
  onOpenPlayer,
  onOpenProfile,
}: LeaderboardPanelProps) {
  const [main, setMain] = useState<MainTab>("rankings");
  const [rankSub, setRankSub] = useState<RankingSub>("alltime");
  const [statsSub, setStatsSub] = useState<StatsSub>("most_wins");

  const sortedByRating = useMemo(
    () =>
      [...players]
        .sort((a, b) => b.rating - a.rating),
    [players],
  );

  const currentRankById = useMemo(() => {
    const m = new Map<string, number>();
    sortedByRating.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [sortedByRating]);

  const mePlayer = players.find((p) => p.id === meId);
  const myRank = mePlayer ? (currentRankById.get(mePlayer.id) ?? 0) : 0;

  const rankedList = useMemo(() => {
    const active = players;
    if (main === "stats") return sortByStat(active, statsSub);
    if (rankSub === "weekly") {
      return [...active]
        .map((p) => ({
          p,
          gain: p.rating - p.ratingLastWeek,
        }))
        .filter((x) => x.gain > 0)
        .sort((a, b) => b.gain - a.gain || b.p.rating - a.p.rating)
        .map((x) => x.p);
    }
    if (rankSub === "hottest") {
      return [...active]
        .filter((p) => Number(p.streak) > 0)
        .sort((a, b) => {
          const sa = Math.max(0, Number(a.streak) || 0);
          const sb = Math.max(0, Number(b.streak) || 0);
          return sb - sa || b.rating - a.rating;
        });
    }
    return sortedByRating;
  }, [main, rankSub, statsSub, players, sortedByRating]);

  return (
    <div className="space-y-2 pb-8">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-fg">
            1v1 Player Rankings
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
            Rank only moves when you play rated 1v1 matches.
          </p>
        </div>
        {mePlayer ? (
          <button
            type="button"
            onClick={() => onOpenProfile?.()}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-bg-elevated py-0.5 pr-2 pl-0.5"
            aria-label="Your profile"
          >
            <PlayerAvatar
              player={mePlayer}
              size="sm"
              className="!size-8"
              showRank={false}
              showElite
            />
            {myRank ? (
              <span className="text-[10px] font-bold tabular-nums text-court">
                #{myRank}
              </span>
            ) : null}
            <span className="text-[11px] font-semibold tabular-nums text-fg">
              {displayRating(mePlayer.rating)}
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5 rounded-full border border-border bg-bg-elevated p-0.5">
        {(
          [
            ["rankings", "Rankings"],
            ["stats", "Stats"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMain(id)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
              main === id ? "bg-fg text-bg" : "text-fg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {main === "rankings" ? (
        <div className="flex items-center gap-1">
          {(
            [
              ["alltime", "All time"],
              ["weekly", "Weekly"],
              ["hottest", "Hottest"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRankSub(id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                rankSub === id
                  ? "bg-court/15 text-court"
                  : "text-fg-muted hover:bg-bg-elevated",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {STAT_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setStatsSub(c.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                statsSub === c.id
                  ? "bg-court/15 text-court"
                  : "text-fg-muted hover:bg-bg-elevated",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {rankedList.length === 0 ? (
          <p className="rounded-xl border border-border bg-bg-elevated px-4 py-6 text-center text-xs text-fg-muted">
            {rankSub === "weekly"
              ? "No rating climbers this week yet."
              : rankSub === "hottest"
                ? "No active win streaks."
                : "Rankings appear after confirmed 1v1 results."}
          </p>
        ) : (
          rankedList.map((p, i) => {
            const place = i + 1;
            const cityRank = currentRankById.get(p.id) ?? place;
            const move =
              main === "rankings" && rankSub === "alltime"
                ? p.rankLastWeek - cityRank
                : 0;
            const weeklyGain = p.rating - p.ratingLastWeek;
            const isMe = p.id === meId;

            const isCityTop1 = cityRank === 1;
            const isCityTop10 = cityRank <= 10;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenPlayer(p)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  isMe
                    ? "border-court/40 bg-court/10"
                    : "border-border bg-bg-elevated",
                )}
              >
                <span
                  className={cn(
                    "w-5 shrink-0 text-center text-xs font-bold tabular-nums",
                    isCityTop1
                      ? "text-gold"
                      : "text-fg-muted",
                  )}
                >
                  {place}
                </span>
                <PlayerAvatar
                  player={p}
                  size="md"
                  showRank={false}
                  showElite
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">
                    {p.name}
                    {isMe ? (
                      <span className="ml-1 text-[10px] font-medium text-court">
                        you
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] tabular-nums text-fg-muted">
                    {main === "rankings" && rankSub === "weekly" ? (
                      <>
                        {p.weeklyWins}–{p.weeklyLosses}
                        <span className="text-fg-subtle"> · </span>
                        {displayRating(p.rating)}
                      </>
                    ) : main === "rankings" && rankSub === "hottest" ? (
                      <>
                        {displayRating(p.rating)}
                        <span className="text-fg-subtle"> · </span>
                        {p.wins}–{p.losses}
                      </>
                    ) : main === "stats" ? (
                      <>
                        {p.wins}–{p.losses}
                      </>
                    ) : (
                      <>
                        {p.wins}–{p.losses}
                        {main === "rankings" && rankSub === "alltime" ? (
                          <span className="ml-1.5 inline-flex align-middle">
                            <MoveDelta delta={move} />
                          </span>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    main === "rankings" &&
                      (rankSub === "weekly" || rankSub === "hottest")
                      ? "text-success"
                      : "text-fg",
                  )}
                >
                  {main === "stats"
                    ? formatStat(p, statsSub)
                    : main === "rankings" && rankSub === "weekly"
                      ? `+${Math.round(weeklyGain)}`
                      : main === "rankings" && rankSub === "hottest"
                        ? p.streak > 0
                          ? `${p.streak}W`
                          : "—"
                        : displayRating(p.rating)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
