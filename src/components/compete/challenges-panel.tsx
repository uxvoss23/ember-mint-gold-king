import { Award, Check, ChevronLeft } from "lucide-react";
import { hostWonSeries } from "@/lib/upset/stakes";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

type ChallengeDef = {
  id: string;
  title: string;
  detail: string;
  current: number;
  target: number;
};

function cityRanks(players: Player[]) {
  const ordered = [...players]
    .filter((p) => !p.exiled)
    .sort((a, b) => b.rating - a.rating);
  const rank = new Map<string, number>();
  ordered.forEach((p, i) => rank.set(p.id, i + 1));
  return rank;
}

function winnerId(m: Match): string | null {
  if (m.status !== "confirmed" || !m.opponentId || !m.scores?.length) return null;
  return hostWonSeries(m.scores) ? m.hostId : m.opponentId;
}

export function ChallengesPanel({
  me,
  players,
  matches,
  courtCount,
  onBack,
}: {
  me: Player;
  players: Player[];
  matches: Match[];
  courtCount: number;
  onBack: () => void;
}) {
  const ranks = cityRanks(players);
  const wins = matches.filter((m) => winnerId(m) === me.id);
  const beatRanks = wins
    .map((m) => {
      const oppId = m.hostId === me.id ? m.opponentId : m.hostId;
      return oppId ? (ranks.get(oppId) ?? 999) : 999;
    })
    .filter((r) => r < 999);
  const bestBeat = beatRanks.length ? Math.min(...beatRanks) : null;
  const townWins = wins.length;
  const courtsWon = new Set(wins.map((m) => m.courtId)).size;
  const streak = Math.max(0, Number(me.streak) || 0);
  const everyTarget = Math.max(1, courtCount);

  const items: ChallengeDef[] = [
    {
      id: "win-1v1",
      title: "Win a 1v1",
      detail: "Beat an opponent in a rated run.",
      current: Math.min(wins.length, 1),
      target: 1,
    },
    {
      id: "top-50",
      title: "Beat a Top 50",
      detail: "Win against someone ranked 50 or better.",
      current: bestBeat != null && bestBeat <= 50 ? 1 : 0,
      target: 1,
    },
    {
      id: "top-10",
      title: "Beat a Top 10",
      detail: "Win against someone ranked 10 or better.",
      current: bestBeat != null && bestBeat <= 10 ? 1 : 0,
      target: 1,
    },
    {
      id: "top-5",
      title: "Beat a Top 5",
      detail: "Win against someone ranked 5 or better.",
      current: bestBeat != null && bestBeat <= 5 ? 1 : 0,
      target: 1,
    },
    {
      id: "number-1",
      title: "Beat #1",
      detail: "Take down the city #1 ranked player.",
      current: bestBeat === 1 ? 1 : 0,
      target: 1,
    },
    {
      id: "town-5",
      title: "5 wins in town",
      detail: "Win 5 rated games in Upset City.",
      current: Math.min(townWins, 5),
      target: 5,
    },
    {
      id: "streak-10",
      title: "10 in a row",
      detail: "Win 10 rated games without a loss.",
      current: Math.min(streak, 10),
      target: 10,
    },
    {
      id: "every-court",
      title: "Every court",
      detail: "Win a game on every Upset City court.",
      current: Math.min(courtsWon, everyTarget),
      target: everyTarget,
    },
  ];

  const earned = items.filter((c) => c.current >= c.target).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pt-2 pb-6 [-webkit-overflow-scrolling:touch]">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-fg-muted"
          >
            <ChevronLeft className="size-3.5" />
            Explore
          </button>
          <h3 className="font-display text-lg font-semibold text-fg">Challenges</h3>
          <p className="text-[12px] text-fg-muted">
            Earn badges for what you pull off. {earned}/{items.length} unlocked.
          </p>
        </div>

        <div className="space-y-2">
          {items.map((c) => {
            const done = c.current >= c.target;
            const pct = Math.min(100, Math.round((c.current / c.target) * 100));
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-2xl border px-3 py-3",
                  done
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-border bg-bg-elevated",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      done
                        ? "bg-amber-500 text-black"
                        : "bg-bg-subtle text-fg-muted",
                    )}
                  >
                    {done ? (
                      <Check className="size-5" strokeWidth={2.6} />
                    ) : (
                      <Award className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-fg">{c.title}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                      {c.detail}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          done ? "bg-amber-500" : "bg-court",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-medium tabular-nums text-fg-subtle">
                      {done
                        ? "Badge earned"
                        : `${c.current} / ${c.target}`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
