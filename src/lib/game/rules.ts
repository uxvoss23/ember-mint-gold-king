/**
 * Pure competitive-loop rules. Shared by the server and tests.
 * The client must not apply ratings or lifecycle transitions itself in production.
 */

import { RATING_FLOOR, rateSeries, type SeriesGameScore } from "../rating/engine.ts";

export const GAME_STATUSES = [
  "open",
  "matched",
  "scheduled",
  "played_pending",
  "confirmed",
  "disputed",
  "cancelled",
  "no_show",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const OPEN_JOINABLE: ReadonlySet<GameStatus> = new Set(["open"]);
export const SCORE_ENTERABLE: ReadonlySet<GameStatus> = new Set([
  "scheduled",
  "matched",
  "disputed",
]);
export const TERMINAL: ReadonlySet<GameStatus> = new Set([
  "confirmed",
  "cancelled",
  "no_show",
]);

export type JoinResult =
  | { ok: true; status: "scheduled" }
  | { ok: false; reason: "filled" | "invite_only" | "self" | "cancelled" | "not_open" };

export function canJoinGame(input: {
  status: GameStatus;
  hostId: string;
  opponentId?: string | null;
  inviteOnly: boolean;
  inviteeIds: string[];
  actorId: string;
}): JoinResult {
  if (input.actorId === input.hostId) return { ok: false, reason: "self" };
  if (input.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (input.status !== "open" || input.opponentId) {
    if (input.opponentId === input.actorId && input.status === "scheduled") {
      return { ok: true, status: "scheduled" }; // idempotent re-join
    }
    return { ok: false, reason: input.status === "open" ? "filled" : "not_open" };
  }
  if (input.inviteOnly && !input.inviteeIds.includes(input.actorId)) {
    return { ok: false, reason: "invite_only" };
  }
  return { ok: true, status: "scheduled" };
}

export function canEnterScore(input: {
  status: GameStatus;
  hostId: string;
  opponentId?: string | null;
  actorId: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.opponentId) return { ok: false, reason: "Game has no opponent yet." };
  if (input.actorId !== input.hostId && input.actorId !== input.opponentId) {
    return { ok: false, reason: "Only participants can submit a score." };
  }
  if (!SCORE_ENTERABLE.has(input.status)) {
    return { ok: false, reason: "This game is not waiting for a score." };
  }
  return { ok: true };
}

export function canConfirmScore(input: {
  status: GameStatus;
  hostId: string;
  opponentId?: string | null;
  scoreEnteredBy?: string | null;
  actorId: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.status !== "played_pending") {
    return { ok: false, reason: "No pending result to confirm." };
  }
  if (!input.opponentId || !input.scoreEnteredBy) {
    return { ok: false, reason: "Score has not been submitted." };
  }
  if (input.actorId !== input.hostId && input.actorId !== input.opponentId) {
    return { ok: false, reason: "Only participants can confirm." };
  }
  if (input.actorId === input.scoreEnteredBy) {
    return { ok: false, reason: "You cannot confirm your own submission." };
  }
  return { ok: true };
}

export function canDisputeScore(input: {
  status: GameStatus;
  hostId: string;
  opponentId?: string | null;
  scoreEnteredBy?: string | null;
  actorId: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.status !== "played_pending") {
    return { ok: false, reason: "No pending result to dispute." };
  }
  if (!input.opponentId) return { ok: false, reason: "Game has no opponent." };
  if (input.actorId !== input.hostId && input.actorId !== input.opponentId) {
    return { ok: false, reason: "Only participants can dispute." };
  }
  if (input.actorId === input.scoreEnteredBy) {
    return { ok: false, reason: "Wait for your opponent — you submitted this score." };
  }
  return { ok: true };
}

export function hostWonSeries(scores: SeriesGameScore[]): boolean {
  let aWins = 0;
  let bWins = 0;
  for (const g of scores) {
    if (g.a > g.b) aWins += 1;
    else if (g.b > g.a) bWins += 1;
  }
  if (aWins !== bWins) return aWins > bWins;
  const aPts = scores.reduce((n, g) => n + g.a, 0);
  const bPts = scores.reduce((n, g) => n + g.b, 0);
  return aPts >= bPts;
}

export function applyConfirmedResult(input: {
  host: { rating: number; gamesPlayed: number; wins: number; losses: number; streak: number; pointsScored: number; pointsAllowed: number; weeklyWins: number; weeklyLosses: number };
  opp: { rating: number; gamesPlayed: number; wins: number; losses: number; streak: number; pointsScored: number; pointsAllowed: number; weeklyWins: number; weeklyLosses: number };
  scores: SeriesGameScore[];
}) {
  const result = rateSeries(
    { rating: input.host.rating, gamesPlayed: input.host.gamesPlayed },
    { rating: input.opp.rating, gamesPlayed: input.opp.gamesPlayed },
    input.scores,
  );
  const won = hostWonSeries(input.scores);
  const hostPts = input.scores.reduce((n, g) => n + g.a, 0);
  const oppPts = input.scores.reduce((n, g) => n + g.b, 0);
  return {
    result,
    host: {
      rating: Math.max(RATING_FLOOR, result.aNew),
      gamesPlayed: input.host.gamesPlayed + 1,
      wins: input.host.wins + (won ? 1 : 0),
      losses: input.host.losses + (won ? 0 : 1),
      streak: won ? Math.max(0, input.host.streak) + 1 : 0,
      pointsScored: input.host.pointsScored + hostPts,
      pointsAllowed: input.host.pointsAllowed + oppPts,
      weeklyWins: input.host.weeklyWins + (won ? 1 : 0),
      weeklyLosses: input.host.weeklyLosses + (won ? 0 : 1),
    },
    opp: {
      rating: Math.max(RATING_FLOOR, result.bNew),
      gamesPlayed: input.opp.gamesPlayed + 1,
      wins: input.opp.wins + (won ? 0 : 1),
      losses: input.opp.losses + (won ? 1 : 0),
      streak: won ? 0 : Math.max(0, input.opp.streak) + 1,
      pointsScored: input.opp.pointsScored + oppPts,
      pointsAllowed: input.opp.pointsAllowed + hostPts,
      weeklyWins: input.opp.weeklyWins + (won ? 0 : 1),
      weeklyLosses: input.opp.weeklyLosses + (won ? 1 : 0),
    },
    hostWon: won,
  };
}

/** Deterministic ladder order. Rank is derived, never stored as source of truth. */
export function compareLadder(
  a: { rating: number; gamesPlayed: number; wins: number; id: string },
  b: { rating: number; gamesPlayed: number; wins: number; id: string },
): number {
  return (
    b.rating - a.rating ||
    b.gamesPlayed - a.gamesPlayed ||
    b.wins - a.wins ||
    a.id.localeCompare(b.id)
  );
}

export function validateScores(scores: SeriesGameScore[]): string | null {
  if (!scores.length || scores.length > 3) return "Enter 1–3 game scores.";
  for (const g of scores) {
    if (!Number.isInteger(g.a) || !Number.isInteger(g.b)) return "Scores must be whole numbers.";
    if (g.a < 0 || g.b < 0 || g.a > 99 || g.b > 99) return "Scores look invalid.";
    if (g.a === g.b) return "Games cannot end in a tie.";
  }
  return null;
}
