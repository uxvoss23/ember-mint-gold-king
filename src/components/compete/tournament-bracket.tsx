import { useMemo, useRef } from "react";
import { ChevronLeft, Crown, Radio } from "lucide-react";
import {
  buildBracket,
  roundLabel,
  type BracketMatch,
  type TournamentBracket,
} from "@/lib/upset/tournament-bracket";
import type { Player } from "@/lib/upset/types";
import type { GameMode } from "@/lib/upset/tournament-bracket";
import { cn } from "@/lib/utils";

interface TournamentBracketViewProps {
  tournamentId: string;
  name: string;
  mode: GameMode;
  size: number;
  progressRounds?: number;
  players: Player[];
  meId: string;
  onBack: () => void;
}

const MATCH_H = 72;
const MATCH_GAP = 12;
const COL_W = 168;
const COL_GAP = 28;

export function TournamentBracketView({
  tournamentId,
  name,
  mode,
  size,
  progressRounds,
  players,
  meId,
  onBack,
}: TournamentBracketViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const bracket = useMemo(
    () =>
      buildBracket({
        tournamentId,
        name,
        mode,
        size,
        players,
        meId,
        progressRounds,
      }),
    [tournamentId, name, mode, size, players, meId, progressRounds],
  );

  const totalRounds = bracket.rounds.length;
  // vertical spacing doubles each round so connectors meet
  const unit = MATCH_H + MATCH_GAP;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted"
          aria-label="Back to tournaments"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-court uppercase">
            Bracket · {size}-player
          </p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-fg">
            {name}
          </h3>
          {bracket.championName ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-gold">
              <Crown className="size-3.5" strokeWidth={2} />
              Champion · {bracket.championName}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-fg-muted">
              Single elimination · swipe to see later rounds
            </p>
          )}
        </div>
      </div>

      {/* Round chips — jump scroll */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {bracket.rounds.map((_, r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTo({
                left: r * (COL_W + COL_GAP),
                behavior: "smooth",
              });
            }}
            className="shrink-0 rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-[11px] font-semibold text-fg-muted"
          >
            {roundLabel(r, totalRounds)}
          </button>
        ))}
      </div>

      {/* Scrollable bracket canvas */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden rounded-2xl border border-border bg-bg-elevated no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="relative"
          style={{
            width: totalRounds * (COL_W + COL_GAP) + 16,
            height: (size / 2) * unit + 40,
            padding: "16px 12px",
          }}
        >
          {/* Connector lines */}
          <svg
            className="pointer-events-none absolute inset-0"
            width="100%"
            height="100%"
            aria-hidden
          >
            {bracket.rounds.slice(0, -1).map((round, r) =>
              round.map((m, i) => {
                if (i % 2 !== 0) return null;
                const nextI = Math.floor(i / 2);
                const y1 = matchCenterY(r, i, unit) + 16;
                const y2 = matchCenterY(r, i + 1, unit) + 16;
                const yMid = matchCenterY(r + 1, nextI, unit) + 16;
                const x0 = 12 + r * (COL_W + COL_GAP) + COL_W;
                const x1 = x0 + COL_GAP / 2;
                const x2 = 12 + (r + 1) * (COL_W + COL_GAP);
                return (
                  <g key={`line-${r}-${i}`} stroke="var(--color-border-strong)" fill="none" strokeWidth="1.5">
                    <path
                      d={`M ${x0} ${y1} H ${x1} V ${y2} H ${x0}`}
                      opacity={0.7}
                    />
                    <path d={`M ${x1} ${(y1 + y2) / 2} H ${x2}`} opacity={0.7} />
                    <circle cx={x2} cy={yMid} r="2" fill="var(--color-border-strong)" />
                  </g>
                );
              }),
            )}
          </svg>

          {bracket.rounds.map((round, r) => (
            <div
              key={r}
              className="absolute top-4"
              style={{ left: 12 + r * (COL_W + COL_GAP), width: COL_W }}
            >
              <p className="mb-2 text-center text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                {roundLabel(r, totalRounds)}
              </p>
              {round.map((m, i) => {
                const top = matchTopY(r, i, unit);
                return (
                  <div
                    key={m.id}
                    className="absolute left-0 w-full"
                    style={{ top: top + 18 }}
                  >
                    <MatchCard match={m} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Legend />
      <MyPath bracket={bracket} meId={meId} />
    </div>
  );
}

function matchTopY(round: number, index: number, unit: number) {
  const span = 2 ** round;
  return index * span * unit + ((span - 1) * unit) / 2;
}

function matchCenterY(round: number, index: number, unit: number) {
  return matchTopY(round, index, unit) + MATCH_H / 2;
}

function MatchCard({ match }: { match: BracketMatch }) {
  const live = match.status === "live";
  const done = match.status === "final" || match.status === "bye";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-bg-subtle shadow-sm",
        live ? "border-court ring-1 ring-court/30" : "border-border",
      )}
      style={{ height: MATCH_H }}
    >
      {live && (
        <div className="flex items-center justify-center gap-1 border-b border-court/20 bg-court-soft py-0.5 text-[9px] font-semibold tracking-wide text-court uppercase">
          <Radio className="size-2.5 animate-pulse" strokeWidth={2.5} />
          Live
        </div>
      )}
      <SlotRow slot={match.top} done={done} compact={live} />
      <div className="h-px bg-border" />
      <SlotRow slot={match.bottom} done={done} compact={live} />
    </div>
  );
}

function SlotRow({
  slot,
  done,
  compact,
}: {
  slot: BracketMatch["top"];
  done: boolean;
  compact?: boolean;
}) {
  const winner = done && slot.isWinner;
  const loser = done && !slot.isWinner && slot.name !== "TBD" && slot.name !== "BYE";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2",
        compact ? "py-1" : "py-1.5",
        winner && "bg-court-soft/50",
        slot.isYou && !winner && "bg-bg-soft",
      )}
    >
      {slot.seed != null ? (
        <span className="w-3.5 shrink-0 text-[9px] font-semibold tabular-nums text-fg-subtle">
          {slot.seed}
        </span>
      ) : (
        <span className="w-3.5" />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[11px] font-semibold",
          winner ? "text-fg" : loser ? "text-fg-subtle line-through decoration-fg-subtle/50" : "text-fg",
          slot.name === "TBD" && "font-normal text-fg-subtle",
          slot.isYou && "text-court",
        )}
      >
        {slot.name}
        {slot.isYou ? " · you" : ""}
      </span>
      {slot.score != null && (
        <span
          className={cn(
            "tabular-nums text-[11px] font-semibold",
            winner ? "text-fg" : "text-fg-muted",
          )}
        >
          {slot.score}
        </span>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-fg-subtle">
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-full bg-court" /> Live
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-court">You</span> highlighted
      </span>
      <span>Winners bold · losers struck</span>
    </div>
  );
}

function MyPath({
  bracket,
  meId,
}: {
  bracket: TournamentBracket;
  meId: string;
}) {
  const path = useMemo(() => {
    const hits: string[] = [];
    for (const round of bracket.rounds) {
      for (const m of round) {
        if (m.top.playerId === meId || m.bottom.playerId === meId) {
          const opp =
            m.top.playerId === meId ? m.bottom.name : m.top.name;
          const result =
            m.status === "final" || m.status === "bye"
              ? (m.top.playerId === meId ? m.top.isWinner : m.bottom.isWinner)
                ? "W"
                : "L"
              : m.status === "live"
                ? "LIVE"
                : "TBD";
          hits.push(`${roundLabel(m.round, bracket.rounds.length)} vs ${opp} · ${result}`);
        }
      }
    }
    return hits;
  }, [bracket, meId]);

  if (path.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-xs text-fg-muted">
        You’re not seeded in this field yet — register to claim a slot.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
        Your path
      </p>
      <ul className="mt-1.5 space-y-1">
        {path.map((line) => (
          <li key={line} className="text-xs text-fg-muted">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
