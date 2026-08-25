import { compareLadder } from "@/lib/game/rules";
import { GUEST_PLAYER_ID } from "@/lib/game/guest";
import type { Player } from "@/lib/upset/types";

const TOP_N = 50;

let lastPlayers: Player[] | null = null;
let rankById = new Map<string, number>();

/** Rebuild only when the players array reference changes (store emit). */
export function ensureCityRanks(players: Player[]) {
  if (players === lastPlayers) return;
  lastPlayers = players;
  const ordered = [...players]
    .filter((p) => p.id !== GUEST_PLAYER_ID)
    .filter((p) => p.city === "Austin" || !p.city)
    .sort(compareLadder);
  const next = new Map<string, number>();
  ordered.forEach((p, i) => next.set(p.id, i + 1));
  rankById = next;
}

/** City rank 1..50, or null if unranked / not in top 50. */
export function cityRankOf(playerId: string): number | null {
  const r = rankById.get(playerId);
  if (r == null || r > TOP_N) return null;
  return r;
}

export function isKingRank(rank: number | null | undefined) {
  return rank === 1;
}

export function isEliteRank(rank: number | null | undefined) {
  return rank != null && rank >= 1 && rank <= 10;
}
