import type { GameStatus } from "./rules";

/** How long a listed 1v1 occupies the calendar (tip-off through a typical series). */
export const GAME_HOLD_MS = 90 * 60 * 1000;

export const ACTIVE_SCHEDULE_STATUSES: ReadonlySet<GameStatus> = new Set([
  "open",
  "matched",
  "scheduled",
  "played_pending",
]);

export type BusyReason = "yours" | "court";

export type BusySlot = {
  atMs: number;
  reason: BusyReason;
  courtId?: string;
  gameId?: string;
};

export type ScheduleGame = {
  id: string;
  hostId: string;
  opponentId?: string | null;
  courtId: string;
  status: string;
  preferredAt: string;
  scheduledAt?: string | null;
};

export function tipMs(game: { preferredAt: string; scheduledAt?: string | null }): number {
  const raw = game.scheduledAt || game.preferredAt;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function holdsOverlap(aMs: number, bMs: number, holdMs = GAME_HOLD_MS): boolean {
  if (!aMs || !bMs) return false;
  return aMs < bMs + holdMs && bMs < aMs + holdMs;
}

export function collectBusySlots(
  games: ScheduleGame[],
  opts: { playerId: string; courtId?: string; ignoreGameId?: string },
): BusySlot[] {
  const out: BusySlot[] = [];
  const seen = new Set<string>();
  for (const g of games) {
    if (opts.ignoreGameId && g.id === opts.ignoreGameId) continue;
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    if (!ACTIVE_SCHEDULE_STATUSES.has(g.status as GameStatus)) continue;
    const atMs = tipMs(g);
    if (!atMs) continue;
    const mine = g.hostId === opts.playerId || g.opponentId === opts.playerId;
    if (mine) {
      out.push({ atMs, reason: "yours", courtId: g.courtId, gameId: g.id });
      continue;
    }
    if (opts.courtId && g.courtId === opts.courtId) {
      out.push({ atMs, reason: "court", courtId: g.courtId, gameId: g.id });
    }
  }
  return out;
}

export function slotConflict(
  slotMs: number,
  busy: BusySlot[],
  holdMs = GAME_HOLD_MS,
): BusySlot | undefined {
  return busy.find((b) => holdsOverlap(slotMs, b.atMs, holdMs));
}

export function conflictMessage(reason: BusyReason): string {
  return reason === "yours"
    ? "You already have a game at that time."
    : "That court is already booked at that time.";
}
