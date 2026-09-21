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

export function canAccessGameChat(input: {
  hostId: string;
  opponentId?: string | null;
  actorId: string | null | undefined;
  inviteeIds?: readonly string[];
  /** When false, any signed-in player may inquire on an open public game. */
  inviteOnly?: boolean;
}): boolean {
  if (!input.actorId) return false;
  if (input.actorId === input.hostId || input.actorId === input.opponentId) return true;
  if (input.opponentId) return false;
  if (input.inviteOnly === false) return true;
  return (input.inviteeIds ?? []).includes(input.actorId);
}

/** Messages in one host↔player thread. Legacy unthreaded rows stay on the opponent thread. */
export function messagesInThread<T extends { threadWithId?: string }>(
  chat: ReadonlyArray<T>,
  threadWithId: string,
  opponentId?: string | null,
): T[] {
  return chat.filter((m) => {
    if (m.threadWithId) return m.threadWithId === threadWithId;
    return !!opponentId && threadWithId === opponentId;
  });
}

export function chatThreadIds(
  chat: ReadonlyArray<{ threadWithId?: string }>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const m of chat) {
    const id = m.threadWithId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function isBlockedPair(
  actorId: string,
  otherId: string,
  blocks: ReadonlyArray<{ actorId: string; targetId: string }>,
): boolean {
  return blocks.some(
    (b) =>
      (b.actorId === actorId && b.targetId === otherId) ||
      (b.actorId === otherId && b.targetId === actorId),
  );
}

export function canApplyScoreSubmission(input: {
  status: GameStatus;
  existingKey?: string | null;
  incomingKey: string;
  existingAtMs?: number | null;
  incomingAtMs: number;
}): { ok: true; idempotent?: boolean } | { ok: false; reason: string } {
  if (input.status === "confirmed") {
    return { ok: false, reason: "A confirmed result cannot be replaced." };
  }
  if (input.status === "cancelled" || input.status === "no_show") {
    return { ok: false, reason: "This game is closed." };
  }
  if (input.existingKey && input.existingKey === input.incomingKey) {
    return { ok: true, idempotent: true };
  }
  if (
    input.existingAtMs != null &&
    Number.isFinite(input.existingAtMs) &&
    input.incomingAtMs < input.existingAtMs
  ) {
    return { ok: false, reason: "Stale score submission." };
  }
  return { ok: true };
}

export function canCancelGame(input: {
  status: GameStatus;
  hostId: string;
  opponentId?: string | null;
  actorId: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.status === "confirmed") {
    return { ok: false, reason: "A confirmed result cannot be cancelled." };
  }
  if (input.actorId !== input.hostId && input.actorId !== input.opponentId) {
    return { ok: false, reason: "Only participants can leave this game." };
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
  return aWins > bWins;
}

/** Official copy. Use everywhere. */
export const RATED_RULES_COPY =
  "Best of 3 · games to 11 · win by 2 · make it take it · rated.";

const MAX_REASONABLE_SCORE = 50;

function isScoreNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && Number.isFinite(n);
}

/** One game to 11, win by 2. After 10–10, first to lead by exactly two. */
export function validateGameScore(a: unknown, b: unknown, gameIndex = 1): string | null {
  const label = `Game ${gameIndex}`;
  if (a == null || b == null || a === "" || b === "") {
    return `${label} scores are missing.`;
  }
  if (typeof a === "number" && !Number.isInteger(a) && Number.isFinite(a)) {
    return `${label} scores must be whole numbers.`;
  }
  if (typeof b === "number" && !Number.isInteger(b) && Number.isFinite(b)) {
    return `${label} scores must be whole numbers.`;
  }
  if (!isScoreNumber(a) || !isScoreNumber(b)) {
    return `${label} scores must be whole numbers.`;
  }
  if (a < 0 || b < 0) return `${label} scores cannot be negative.`;
  if (a > MAX_REASONABLE_SCORE || b > MAX_REASONABLE_SCORE) {
    return `${label} scores look too large.`;
  }
  if (a === b) return `${label} cannot end in a tie.`;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const margin = hi - lo;
  if (hi < 11) {
    return `${label} is played to 11.`;
  }
  if (hi === 11) {
    if (lo >= 10) {
      return `${label}: at 10–10, play continues until one player leads by two.`;
    }
    return null;
  }
  // hi >= 12: deuce — loser reached 10, winner leads by exactly 2
  if (lo < 10) {
    return `${label}: once a game goes past 11, both players must have reached 10.`;
  }
  if (margin !== 2) {
    return `${label}: after 10–10, the winner must lead by exactly two.`;
  }
  return null;
}

function gameWins(scores: SeriesGameScore[]): { aWins: number; bWins: number } {
  let aWins = 0;
  let bWins = 0;
  for (const g of scores) {
    if (g.a > g.b) aWins += 1;
    else if (g.b > g.a) bWins += 1;
  }
  return { aWins, bWins };
}

/**
 * Authoritative rated-series validator. Best of 3, to 11, win by 2.
 * Returns a user-facing error or null when the series is complete and legal.
 */
export function validateScores(scores: unknown): string | null {
  if (!Array.isArray(scores) || scores.length === 0) {
    return "Enter the game scores.";
  }
  if (scores.length > 3) {
    return "A series is best of three — at most three games.";
  }

  const games: SeriesGameScore[] = [];
  for (let i = 0; i < scores.length; i++) {
    const raw = scores[i];
    if (!raw || typeof raw !== "object") {
      return `Game ${i + 1} scores are missing.`;
    }
    const rec = raw as { a?: unknown; b?: unknown };
    const err = validateGameScore(rec.a, rec.b, i + 1);
    if (err) return err;
    games.push({ a: rec.a as number, b: rec.b as number });
    const { aWins, bWins } = gameWins(games);
    if (i < scores.length - 1 && (aWins === 2 || bWins === 2)) {
      return "No game may be entered after the series is already decided.";
    }
  }

  const { aWins, bWins } = gameWins(games);
  if (aWins < 2 && bWins < 2) {
    if (games.length === 1) {
      return "A series is won by taking two games.";
    }
    if (games.length === 2) {
      return "The first two games were split — enter Game 3.";
    }
    return "A series is won by taking two games.";
  }
  if ((aWins === 2 && bWins === 0) || (bWins === 2 && aWins === 0)) {
    if (games.length !== 2) return "A sweep is exactly two games.";
  }
  if ((aWins === 2 && bWins === 1) || (bWins === 2 && aWins === 1)) {
    if (games.length !== 3) return "A split series is exactly three games.";
  }
  return null;
}

/** Host is score `a`. Never trust a client-supplied winner. */
export function seriesHostWon(scores: SeriesGameScore[]): boolean {
  const invalid = validateScores(scores);
  if (invalid) throw new Error(invalid);
  return hostWonSeries(scores);
}

export function applyConfirmedResult(input: {
  host: { rating: number; gamesPlayed: number; wins: number; losses: number; streak: number; pointsScored: number; pointsAllowed: number; weeklyWins: number; weeklyLosses: number };
  opp: { rating: number; gamesPlayed: number; wins: number; losses: number; streak: number; pointsScored: number; pointsAllowed: number; weeklyWins: number; weeklyLosses: number };
  scores: SeriesGameScore[];
}) {
  const invalid = validateScores(input.scores);
  if (invalid) throw new Error(invalid);
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
