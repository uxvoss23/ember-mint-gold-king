/**
 * Match Mode ordering: nearest skill + height first, then widen.
 * Lower score = closer matchup.
 */

export type MatchClosenessPlayer = {
  id?: string;
  rating: number;
  heightIn: number;
};

/** One rating band (~a game) and 2" of height count about the same. */
export function matchClosenessScore(
  me: MatchClosenessPlayer,
  other: MatchClosenessPlayer,
): number {
  const ratingGap = Math.abs((other.rating || 0) - (me.rating || 0));
  const heightGap = Math.abs((other.heightIn || 0) - (me.heightIn || 0));
  return ratingGap / 40 + heightGap / 2;
}

/** 0 = same band, 1 = close, 2 = stretch, 3 = far. */
export function matchClosenessRing(score: number): 0 | 1 | 2 | 3 {
  if (score <= 1.5) return 0;
  if (score <= 3.5) return 1;
  if (score <= 6.5) return 2;
  return 3;
}

export function compareMatchCloseness(
  me: MatchClosenessPlayer,
  a: MatchClosenessPlayer,
  b: MatchClosenessPlayer,
  extra?: {
    inboundIds?: ReadonlySet<string>;
    milesA?: number;
    milesB?: number;
  },
): number {
  const sa = matchClosenessScore(me, a);
  const sb = matchClosenessScore(me, b);
  const ra = matchClosenessRing(sa);
  const rb = matchClosenessRing(sb);
  if (ra !== rb) return ra - rb;
  if (sa !== sb) return sa - sb;
  const ia = a.id && extra?.inboundIds?.has(a.id) ? 1 : 0;
  const ib = b.id && extra?.inboundIds?.has(b.id) ? 1 : 0;
  if (ia !== ib) return ib - ia;
  return (extra?.milesA ?? 99) - (extra?.milesB ?? 99);
}
