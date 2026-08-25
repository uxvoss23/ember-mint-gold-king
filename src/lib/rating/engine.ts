/**
 * Upset City rating engine — port of the measured formula from the product spec.
 * Pure TS, no deps. Keep full float precision in storage; display rounded ints.
 *
 * Two curves must both exist (spread_win + spread_share). Do not collapse them.
 * If you change `w`, spread_win must be refitted.
 */

export const RATING_CONSTANTS = {
  w: 0.8,
  spreadWin: 400,
  spreadShare: 1910,
  k0: 97,
  kMin: 8,
  halfLife: 20,
} as const;

/** Hard floor — losing everything cannot drop a player below this. */
export const RATING_FLOOR = 100;

export interface RatingPlayer {
  rating: number;
  gamesPlayed: number;
}

export interface SeriesGameScore {
  /** Points scored by player A in this game */
  a: number;
  /** Points scored by player B in this game */
  b: number;
}

export interface RatingResult {
  aDelta: number;
  bDelta: number;
  aNew: number;
  bNew: number;
  /** Actual blended score for A (0–1) */
  actualA: number;
  expectedA: number;
}

export function kFactor(gamesPlayed: number): number {
  const { k0, kMin, halfLife } = RATING_CONSTANTS;
  return kMin + (k0 - kMin) / (1 + gamesPlayed / halfLife);
}

export function expectedWinProbability(myRating: number, oppRating: number): number {
  const { spreadWin } = RATING_CONSTANTS;
  return 1 / (1 + 10 ** ((oppRating - myRating) / spreadWin));
}

export function expectedPointShare(myRating: number, oppRating: number): number {
  const { spreadShare } = RATING_CONSTANTS;
  return 1 / (1 + 10 ** ((oppRating - myRating) / spreadShare));
}

export function expectedBlended(myRating: number, oppRating: number): number {
  const { w } = RATING_CONSTANTS;
  return (
    w * expectedPointShare(myRating, oppRating) +
    (1 - w) * expectedWinProbability(myRating, oppRating)
  );
}

/**
 * Best-of-three series score totals → actual blended value for A.
 * Winner never loses rating (delta floored at 0 on a win).
 */
export function rateSeries(
  a: RatingPlayer,
  b: RatingPlayer,
  games: SeriesGameScore[],
): RatingResult {
  const { w } = RATING_CONSTANTS;
  let aPts = 0;
  let bPts = 0;
  for (const g of games) {
    aPts += g.a;
    bPts += g.b;
  }
  const total = aPts + bPts;
  const pointShareA = total > 0 ? aPts / total : 0.5;
  // series winner: more games won, or more points if tied games
  let aWins = 0;
  let bWins = 0;
  for (const g of games) {
    if (g.a > g.b) aWins++;
    else if (g.b > g.a) bWins++;
  }
  const aWonSeries = aWins > bWins || (aWins === bWins && aPts >= bPts);

  const actualA = w * pointShareA + (1 - w) * (aWonSeries ? 1 : 0);
  const expectedA = expectedBlended(a.rating, b.rating);

  let aDelta = kFactor(a.gamesPlayed) * (actualA - expectedA);
  let bDelta = kFactor(b.gamesPlayed) * ((1 - actualA) - (1 - expectedA));

  // A win never costs rating
  if (aWonSeries && aDelta < 0) aDelta = 0;
  if (!aWonSeries && bDelta < 0) bDelta = 0;

  return {
    aDelta,
    bDelta,
    aNew: Math.max(RATING_FLOOR, a.rating + aDelta),
    bNew: Math.max(RATING_FLOOR, b.rating + bDelta),
    actualA,
    expectedA,
  };
}

/**
 * Handicap line for display before a game.
 * Returns underdog target-ish guidance based on expected point share.
 */
export function handicapLine(myRating: number, oppRating: number): {
  winProb: number;
  isFavorite: boolean;
  /** Suggested points-per-game target to gain rating even on a loss (underdog) */
  targetPoints: number;
  display: string;
} {
  const winProb = expectedWinProbability(myRating, oppRating);
  const share = expectedPointShare(myRating, oppRating);
  const isFavorite = myRating >= oppRating;

  // Games to 11: translate expected share into a soft target score
  // Underdog: score enough that point_share stays near expected → still gain on close loss
  // Favorite: win by ~4+ (roughly 11-7) to gain meaningfully
  if (!isFavorite) {
    // Need slightly better than expected share to gain — aim for ceil(11 * share + 1) style
    const target = Math.max(4, Math.min(10, Math.round(11 * share + 1)));
    return {
      winProb,
      isFavorite,
      targetPoints: target,
      display: `Score ${target}+ a game and your rating goes up even if you lose.`,
    };
  }
  const margin = Math.max(2, Math.min(6, Math.round(11 * (2 * share - 1) + 2)));
  return {
    winProb,
    isFavorite,
    targetPoints: 11,
    display: `Win by ${margin}+ to gain rating.`,
  };
}

export function displayRating(r: number): number {
  return Math.round(r);
}
