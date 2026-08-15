/**
 * Auto court picks for Hoop Now — no prefs form.
 * Highest quality + convenience for both players:
 * midpoint fairness, shade (TX), home courts, favorites, past good runs.
 */

import {
  haversineMi,
  midpoint,
  type GeoPoint,
} from "@/lib/maps/midpoint-courts";

const HIGH_RATED = new Set([
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

export type SmartMeetCourt<T extends { id: string; lat: number; lon: number }> =
  T & {
    youMi: number;
    themMi: number;
    midMi: number;
    score: number;
    reasons: string[];
    isTopPick: boolean;
  };

export type SmartMeetSignals = {
  youHomeCourtId?: string;
  themHomeCourtId?: string;
  /** Your favorited court ids */
  youFavoriteIds?: string[];
  /** Their favorites if known */
  themFavoriteIds?: string[];
  /** Courts you've played (confirmed) — especially good experiences */
  youPastCourtIds?: string[];
  themPastCourtIds?: string[];
  /** Courts with positive outcomes for you (wins / confirmed fun) */
  youGoodCourtIds?: string[];
  themGoodCourtIds?: string[];
};

function isShaded(c: { amenities?: string[] }) {
  return (c.amenities ?? []).includes("shade");
}

/**
 * Rank courts for two players automatically.
 * Lower score = better pick.
 */
export function rankSmartMeetCourts<
  T extends {
    id: string;
    lat: number;
    lon: number;
    amenities?: string[];
    hoops?: number;
  },
>(
  courts: T[],
  you: GeoPoint,
  them: GeoPoint,
  signals: SmartMeetSignals = {},
  opts?: { limit?: number; maxOneWayMi?: number },
): SmartMeetCourt<T>[] {
  const limit = opts?.limit ?? 10;
  const maxOneWay = opts?.maxOneWayMi ?? 15;
  const mid = midpoint(you, them);
  const pairDist = haversineMi(you, them);

  const youFav = new Set(signals.youFavoriteIds ?? []);
  const themFav = new Set(signals.themFavoriteIds ?? []);
  const youPast = new Set(signals.youPastCourtIds ?? []);
  const themPast = new Set(signals.themPastCourtIds ?? []);
  const youGood = new Set(signals.youGoodCourtIds ?? []);
  const themGood = new Set(signals.themGoodCourtIds ?? []);

  const scored = courts
    .map((c) => {
      const youMi = haversineMi(you, c);
      const themMi = haversineMi(them, c);
      const midMi = haversineMi(mid, c);
      const imbalance = Math.abs(youMi - themMi);
      const maxDrive = Math.max(youMi, themMi);
      const reasons: string[] = [];

      // Base: fairness + midpoint (miles)
      let score =
        midMi * 2.4 + youMi * 0.9 + themMi * 0.9 + imbalance * 2.0 + maxDrive * 0.4;

      // Texas shade — treat as high quality automatically
      if (isShaded(c)) {
        score -= 55;
        reasons.push("Shaded");
      }

      // UC high-rated list
      if (HIGH_RATED.has(c.id)) {
        score -= 40;
        reasons.push("Highest rated");
      }

      // Amenities
      const a = new Set(c.amenities ?? []);
      if (a.has("lights")) {
        score -= 12;
        reasons.push("Lights");
      }
      if (a.has("parking")) score -= 8;
      if (a.has("multiple")) score -= 10;
      if ((c.hoops ?? 0) >= 4) score -= 8;

      // Home courts
      if (signals.youHomeCourtId === c.id) {
        score -= 28;
        reasons.push("Your home");
      }
      if (signals.themHomeCourtId === c.id) {
        score -= 28;
        reasons.push("Their home");
      }

      // Favorites
      if (youFav.has(c.id)) {
        score -= 32;
        reasons.push("You favorited");
      }
      if (themFav.has(c.id)) {
        score -= 32;
        reasons.push("They favorited");
      }
      if (youFav.has(c.id) && themFav.has(c.id)) {
        score -= 20;
        reasons.push("Both favorited");
      }

      // Past play / good experiences
      if (youGood.has(c.id) || themGood.has(c.id)) {
        score -= 26;
        reasons.push("Good past run");
      } else if (youPast.has(c.id) || themPast.has(c.id)) {
        score -= 14;
        reasons.push("Played before");
      }

      // Slight bonus if it's roughly in the middle band
      if (midMi <= Math.max(pairDist * 0.4, 1.5)) {
        score -= 10;
        reasons.push("True midpoint");
      }

      return {
        ...c,
        youMi,
        themMi,
        midMi,
        score,
        reasons: [...new Set(reasons)].slice(0, 4),
        isTopPick: false,
      };
    })
    .filter((c) => c.youMi <= maxOneWay && c.themMi <= maxOneWay)
    // don't send people across the whole metro unless pair is already far
    .filter((c) => c.midMi <= Math.max(pairDist * 0.9, 5) + 3)
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, limit).map((c, i) => ({
    ...c,
    isTopPick: i === 0,
  }));
}

/** Past court ids from confirmed matches for a player */
export function pastCourtsFromMatches(
  matches: Array<{
    status: string;
    hostId: string;
    opponentId?: string;
    courtId: string;
    scores?: { a: number; b: number }[];
  }>,
  playerId: string,
): { past: string[]; good: string[] } {
  const past: string[] = [];
  const good: string[] = [];
  for (const m of matches) {
    if (m.status !== "confirmed" || !m.opponentId) continue;
    if (m.hostId !== playerId && m.opponentId !== playerId) continue;
    past.push(m.courtId);
    // "good" = played a full series (any confirmed result counts as experience)
    if (m.scores && m.scores.length > 0) good.push(m.courtId);
  }
  return { past: [...new Set(past)], good: [...new Set(good)] };
}
