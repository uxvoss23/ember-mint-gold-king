import type { Player } from "@/lib/upset/types";
import { STARTING_RATING } from "@/lib/config";

export const GUEST_PLAYER_ID = "guest";

/** Honest guest identity — never treated as a ranked account. */
export const GUEST_PLAYER: Player = {
  id: GUEST_PLAYER_ID,
  name: "Guest",
  handle: "guest",
  city: "Austin",
  heightIn: 72,
  weightLb: 175,
  experienceYears: 0,
  rating: STARTING_RATING,
  gamesPlayed: 0,
  sportsmanship: 5,
  reliability: 5,
  wins: 0,
  losses: 0,
  streak: 0,
  availability: "offline",
  hue: 24,
  quietStart: 22,
  quietEnd: 7,
  pingsToday: 0,
  pingsDate: "",
  ignoreStreak: 0,
  preferredHour: 19,
  openToChallenges: false,
  dmPrivacy: "nobody",
  hideFromCatalog: true,
  challengesToday: 0,
  challengesDate: "",
  dmFirstToday: 0,
  dmFirstDate: "",
  rankLastWeek: 0,
  pointsScored: 0,
  pointsAllowed: 0,
  weeklyWins: 0,
  weeklyLosses: 0,
  ratingLastWeek: STARTING_RATING,
};

export function isGuestPlayerId(id: string | undefined | null): boolean {
  return !id || id === GUEST_PLAYER_ID || id === "p-you";
}

export const AUTH_REASON_COPY: Record<string, string> = {
  create: "Sign in to post a 1v1.",
  join: "Sign in to join a game.",
  leave: "Sign in to leave or cancel a game.",
  challenge: "Sign in to challenge a player.",
  message: "Sign in to send a message.",
  score: "Sign in to submit or confirm a score.",
  dispute: "Sign in to open a dispute.",
  profile: "Sign in to edit your competitive profile.",
  like: "Sign in to like or pass on a player.",
  availability: "Sign in to set availability.",
  invite: "Sign in to invite a player.",
  favorite: "Sign in to sync favorites across devices.",
};

const INTENT_KEY = "uc-auth-intent";

export type AuthIntent = { next: string; action?: string };

export function saveAuthIntent(intent: AuthIntent) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

export function consumeAuthIntent(): AuthIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthIntent;
    if (!parsed?.next || typeof parsed.next !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function peekAuthIntent(): AuthIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthIntent;
  } catch {
    return null;
  }
}
