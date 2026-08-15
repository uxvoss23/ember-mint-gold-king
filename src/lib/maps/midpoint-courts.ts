/**
 * Courts that sit between two people — best meeting points for same-day hoop.
 */

export type GeoPoint = { lat: number; lon: number };

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function haversineMi(
  a: GeoPoint,
  b: { lat: number; lon: number },
): number {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Geographic midpoint (simple spherical average — fine for city scale). */
export function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);
  const bx = Math.cos(lat2) * Math.cos(lon2 - lon1);
  const by = Math.cos(lat2) * Math.sin(lon2 - lon1);
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2),
  );
  const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);
  return {
    lat: (lat3 * 180) / Math.PI,
    lon: (((lon3 * 180) / Math.PI + 540) % 360) - 180,
  };
}

export type MeetingCourtScore<T extends { lat: number; lon: number }> = T & {
  midMi: number;
  youMi: number;
  themMi: number;
  maxDriveMi: number;
  score: number;
  /** UC / quality weight 0–1-ish */
  quality: number;
  isHighestRatedMidpoint?: boolean;
};

const HIGH_RATED_IDS = new Set([
  "cat-butler",
  "cat-wooldridge",
  "cat-rosewood",
  "cat-zaragoza",
  "cat-givens",
  "cat-metz",
  "cat-hancock",
  "cat-ramsey",
  "cat-domain",
  "cat-battle-bend",
  "cat-pease",
  "cat-bartholomew",
  "cat-reed",
  "cat-garrison",
  "cat-walnut-creek",
  "cat-circle-c",
  "cat-searight",
]);

function qualityOf(c: {
  id?: string;
  amenities?: string[];
  hoops?: number;
}): number {
  let q = 0;
  if (c.id && HIGH_RATED_IDS.has(c.id)) q += 100;
  const a = new Set(c.amenities ?? []);
  if (a.has("shade")) q += 20;
  if (a.has("lights")) q += 15;
  if (a.has("parking")) q += 10;
  if (a.has("multiple")) q += 12;
  if ((c.hoops ?? 0) >= 4) q += 10;
  return q;
}

/**
 * Rank courts as meeting points between two people.
 * Prefers: close to midpoint, balanced drive, neither person hauling too far.
 */
export function rankMeetingCourts<
  T extends { lat: number; lon: number; id?: string; amenities?: string[]; hoops?: number },
>(
  courts: T[],
  you: GeoPoint,
  them: GeoPoint,
  opts?: { limit?: number; maxOneWayMi?: number },
): MeetingCourtScore<T>[] {
  const limit = opts?.limit ?? 12;
  const maxOneWay = opts?.maxOneWayMi ?? 16;
  const mid = midpoint(you, them);
  const pairDist = haversineMi(you, them);

  const scored = courts
    .map((c) => {
      const youMi = haversineMi(you, c);
      const themMi = haversineMi(them, c);
      const midMi = haversineMi(mid, c);
      const maxDriveMi = Math.max(youMi, themMi);
      const imbalance = Math.abs(youMi - themMi);
      const quality = qualityOf(c);
      // Fairness first, quality as mild boost (inverted into score)
      const score =
        midMi * 2.2 +
        youMi +
        themMi +
        imbalance * 1.4 +
        maxDriveMi * 0.35 -
        quality * 0.02;
      return { ...c, midMi, youMi, themMi, maxDriveMi, score, quality };
    })
    .filter((c) => c.youMi <= maxOneWay && c.themMi <= maxOneWay)
    .filter((c) => c.midMi <= Math.max(pairDist * 0.75, 4) + 2)
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, limit);
}

/**
 * Highest Rated Midpoint — best quality court that still keeps travel fair.
 * Among fair midpoints (balanced drives), pick the highest-rated; rest follow.
 */
export function rankHighestRatedMidpoint<
  T extends { lat: number; lon: number; id?: string; amenities?: string[]; hoops?: number },
>(
  courts: T[],
  you: GeoPoint,
  them: GeoPoint,
  opts?: { limit?: number; maxOneWayMi?: number; maxImbalanceMi?: number },
): MeetingCourtScore<T>[] {
  const limit = opts?.limit ?? 12;
  const maxOneWay = opts?.maxOneWayMi ?? 14;
  const maxImbalance = opts?.maxImbalanceMi ?? 4.5;
  const mid = midpoint(you, them);
  const pairDist = haversineMi(you, them);

  const fair = courts
    .map((c) => {
      const youMi = haversineMi(you, c);
      const themMi = haversineMi(them, c);
      const midMi = haversineMi(mid, c);
      const maxDriveMi = Math.max(youMi, themMi);
      const imbalance = Math.abs(youMi - themMi);
      const quality = qualityOf(c);
      // Lower score = better: quality dominates, then fairness
      const score =
        -quality * 3 +
        midMi * 1.6 +
        imbalance * 2.2 +
        maxDriveMi * 0.5 +
        (youMi + themMi) * 0.35;
      return { ...c, midMi, youMi, themMi, maxDriveMi, score, quality };
    })
    .filter((c) => c.youMi <= maxOneWay && c.themMi <= maxOneWay)
    .filter((c) => Math.abs(c.youMi - c.themMi) <= maxImbalance)
    .filter((c) => c.midMi <= Math.max(pairDist * 0.85, 5) + 2.5)
    .sort((a, b) => a.score - b.score);

  // Prefer true high-rated list when available
  const withHigh = fair.filter((c) => c.id && HIGH_RATED_IDS.has(c.id));
  const ordered = (withHigh.length > 0 ? withHigh : fair).concat(
    fair.filter((c) => !(c.id && HIGH_RATED_IDS.has(c.id)) && withHigh.length > 0),
  );
  // de-dupe keep order
  const seen = new Set<string>();
  const out: MeetingCourtScore<T>[] = [];
  for (const c of ordered.length ? ordered : fair) {
    const key = c.id ?? `${c.lat},${c.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...c,
      isHighestRatedMidpoint: out.length === 0,
    });
    if (out.length >= limit) break;
  }
  return out;
}
