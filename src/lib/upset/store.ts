import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { namedAustinCourts } from "@/lib/courts/catalog";
import { displayRating, rateSeries } from "@/lib/rating/engine";
import { ensureCityRanks } from "@/lib/upset/city-rank";
import { SEED_PLAYERS } from "@/lib/upset/seed-players";
import {
  ALZHEIMERS_CHARITY,
  computeStakePayout,
  formatMoney,
} from "@/lib/upset/stakes";
import { useMediaFeed } from "@/lib/upset/media-feed";
import { useCampaign } from "@/lib/upset/campaign";
import {
  createPaymentIntent,
  markPaymentSettled,
} from "@/lib/payments/ledger";
import type {
  CancelLogEntry,
  ChatMessage,
  CourtMeta,
  DirectThread,
  Match,
  MatchGame,
  Player,
  PlayerReview,
  UpsetState,
} from "@/lib/upset/types";

const STORAGE_KEY = "upset-city-v22";
const SEED_VERSION = 25;

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function isKingActive(meta: CourtMeta, now = Date.now()) {
  if (!meta.kingId || !meta.kingLastPlayedAt) return false;
  const ttl = (meta.crownTtlDays ?? 14) * 86400e3;
  return now - new Date(meta.kingLastPlayedAt).getTime() < ttl;
}

export { isKingActive };

function seedMatches(players: Player[]): Match[] {
  const now = Date.now();
  const fri = new Date(now);
  fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7 || 7));
  fri.setHours(19, 0, 0, 0);

  const host = (id: string) => players.find((p) => p.id === id)!;

  return [
    {
      id: "m-seed-1",
      kind: "broadcast",
      format: "1v1",
      allowGuestInvites: false,
      hostId: "p-sean",
      courtId: "cat-givens",
      courtName: "Givens District Park",
      lat: 30.258,
      lon: -97.71,
      preferredAt: new Date(now + 2 * 3600e3).toISOString(),
      status: "open",
      notes: "Charity 1v1 for Alzheimer's · best of 3 to 11. Looking for someone around 6'0–6'3 — clean ball.",
      stakes: {
        mode: "charity",
        dollarsPerPoint: 1,
        fixedPriceDollars: 10,
        amountDollars: 10,
        charityName: ALZHEIMERS_CHARITY.name,
        charityUrl: ALZHEIMERS_CHARITY.url,
      },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 3600e3).toISOString(),
    },
    {
      id: "m-seed-2",
      kind: "broadcast",
      format: "horse",
      allowGuestInvites: true,
      hostId: "p-noah",
      courtId: "cat-battle-bend",
      courtName: "Battle Bend Park Courts",
      lat: 30.215,
      lon: -97.77,
      preferredAt: fri.toISOString(),
      status: "open",
      notes: "HORSE for Alzheimer's research · outdoor · clean calls. All skill levels.",
      stakes: {
        mode: "charity",
        dollarsPerPoint: 1,
        fixedPriceDollars: 15,
        amountDollars: 15,
        charityName: ALZHEIMERS_CHARITY.name,
        charityUrl: ALZHEIMERS_CHARITY.url,
      },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1500,
        ratingMax: 2000,
        sportsmanshipMin: 3.5,
        radiusMiles: 15,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 7200e3).toISOString(),
    },
    {
      id: "m-seed-3",
      kind: "broadcast",
      format: "1v1",
      allowGuestInvites: true,
      hostId: "p-kai",
      courtId: "cat-zilker",
      courtName: "Zilker Park Courts",
      lat: 30.2669,
      lon: -97.7729,
      preferredAt: new Date(fri.getTime() + 86400e3).toISOString(),
      status: "open",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      stakes: { mode: "fun", dollarsPerPoint: 1 },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 90,
        ratingMin: 1300,
        ratingMax: 2200,
        sportsmanshipMin: 3,
        radiusMiles: 20,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 1800e3).toISOString(),
    },
    {
      id: "m-seed-upcoming",
      kind: "broadcast",
      format: "1v1",
      allowGuestInvites: false,
      hostId: "p-marcus",
      opponentId: "p-you",
      courtId: "cat-rosewood",
      courtName: "Rosewood Park Courts",
      lat: 30.2705,
      lon: -97.7195,
      preferredAt: new Date(now + 26 * 3600e3).toISOString(),
      scheduledAt: new Date(now + 26 * 3600e3).toISOString(),
      acceptedAt: new Date(now - 900e3).toISOString(),
      status: "scheduled",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      stakes: {
        mode: "charity",
        dollarsPerPoint: 1,
        fixedPriceDollars: 10,
        amountDollars: 10,
        charityName: ALZHEIMERS_CHARITY.name,
        charityUrl: ALZHEIMERS_CHARITY.url,
      },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2000,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [
        {
          id: "c-seed-u1",
          authorName: "Marcus",
          text: "See you at Rosewood.",
          at: new Date(now - 800e3).toISOString(),
        },
      ],
      createdAt: new Date(now - 3 * 3600e3).toISOString(),
    },
    // Past confirmed results — scouting / mutual opponents
    {
      id: "m-hist-1",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-sean",
      opponentId: "p-kai",
      courtId: "cat-givens",
      courtName: "Givens District Park",
      lat: 30.258,
      lon: -97.71,
      preferredAt: new Date(now - 12 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 12 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      scores: [
        { a: 11, b: 7 },
        { a: 11, b: 9 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 13 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-2",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-you",
      opponentId: "p-kai",
      courtId: "cat-battle-bend",
      courtName: "Battle Bend Park Courts",
      lat: 30.215,
      lon: -97.77,
      preferredAt: new Date(now - 8 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 8 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      scores: [
        { a: 11, b: 8 },
        { a: 9, b: 11 },
        { a: 11, b: 6 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 9 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-3",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-noah",
      opponentId: "p-you",
      courtId: "cat-zilker",
      courtName: "Zilker Park Courts",
      lat: 30.2669,
      lon: -97.7729,
      preferredAt: new Date(now - 5 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 5 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      scores: [
        { a: 11, b: 5 },
        { a: 11, b: 9 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 6 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-4",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-sean",
      opponentId: "p-noah",
      courtId: "cat-givens",
      courtName: "Givens District Park",
      lat: 30.258,
      lon: -97.71,
      preferredAt: new Date(now - 4 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 4 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      scores: [
        { a: 11, b: 10 },
        { a: 8, b: 11 },
        { a: 11, b: 7 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 4.5 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-5",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-marcus",
      opponentId: "p-sean",
      courtId: "cat-rosewood",
      courtName: "Rosewood Park Courts",
      lat: 30.2705,
      lon: -97.7195,
      preferredAt: new Date(now - 10 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 10 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      scores: [
        { a: 11, b: 6 },
        { a: 11, b: 9 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 11 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-6",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-you",
      opponentId: "p-marcus",
      courtId: "cat-battle-bend",
      courtName: "Battle Bend Park Courts",
      lat: 30.215,
      lon: -97.77,
      preferredAt: new Date(now - 15 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 15 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      scores: [
        { a: 7, b: 11 },
        { a: 11, b: 9 },
        { a: 8, b: 11 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 16 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-7",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-kai",
      opponentId: "p-noah",
      courtId: "cat-zilker",
      courtName: "Zilker Park Courts",
      lat: 30.2669,
      lon: -97.7729,
      preferredAt: new Date(now - 3 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 3 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 games · to 11 · win by 2 · call your own fouls.",
      scores: [
        { a: 11, b: 4 },
        { a: 11, b: 8 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 3.2 * 86400e3).toISOString(),
    },
  ].map((m) => {
    void host(m.hostId);
    return m as Match;
  });
}

function seedReviews(): PlayerReview[] {
  const now = Date.now();
  return [
    {
      id: "rv-1",
      targetId: "p-sean",
      authorId: "p-kai",
      authorName: "Kai",
      stars: 5,
      text: "Clean game, calls his own fouls. Tough from midrange.",
      at: new Date(now - 11 * 86400e3).toISOString(),
    },
    {
      id: "rv-2",
      targetId: "p-sean",
      authorId: "p-noah",
      authorName: "Noah",
      stars: 4,
      text: "Strong, physical. Respectful after the run. Want a rematch.",
      at: new Date(now - 3 * 86400e3).toISOString(),
    },
    {
      id: "rv-3",
      targetId: "p-noah",
      authorId: "p-you",
      authorName: "You",
      stars: 5,
      text: "Quick first step. Really good IQ — hard to stop once he gets going.",
      at: new Date(now - 4 * 86400e3).toISOString(),
    },
    {
      id: "rv-4",
      targetId: "p-noah",
      authorId: "p-sean",
      authorName: "Sean Rivera",
      stars: 4,
      text: "Smooth handle. Competes hard without being dirty.",
      at: new Date(now - 4 * 86400e3).toISOString(),
    },
    {
      id: "rv-5",
      targetId: "p-kai",
      authorId: "p-sean",
      authorName: "Sean Rivera",
      stars: 5,
      text: "Long and athletic. Gets to every loose ball.",
      at: new Date(now - 12 * 86400e3).toISOString(),
    },
    {
      id: "rv-6",
      targetId: "p-kai",
      authorId: "p-you",
      authorName: "You",
      stars: 4,
      text: "Can score in bunches. Good sport after a close series.",
      at: new Date(now - 7 * 86400e3).toISOString(),
    },
    {
      id: "rv-7",
      targetId: "p-marcus",
      authorId: "p-you",
      authorName: "You",
      stars: 5,
      text: "Dog. Hits big shots. Shows up on time every run.",
      at: new Date(now - 14 * 86400e3).toISOString(),
    },
    {
      id: "rv-8",
      targetId: "p-marcus",
      authorId: "p-sean",
      authorName: "Sean Rivera",
      stars: 4,
      text: "Aggressive finisher. Talks a little but backs it up.",
      at: new Date(now - 9 * 86400e3).toISOString(),
    },
  ];
}

function seedCourtMeta(players: Player[]): Record<string, CourtMeta> {
  const now = new Date().toISOString();
  const meta: Record<string, CourtMeta> = {};
  for (const p of players) {
    if (!p.homeCourtId) continue;
    if (!meta[p.homeCourtId]) {
      meta[p.homeCourtId] = {
        courtId: p.homeCourtId,
        kingId: p.id,
        kingLastPlayedAt: now,
        chat: [
          {
            id: uid("chat"),
            authorName: "Upset City",
            text: "Court chat is live. Keep it clean.",
            at: now,
            system: true,
          },
        ],
        crownTtlDays: 14,
      };
    }
  }
  // strong kings
  for (const [courtId, kingId] of [
    ["cat-givens", "p-sean"],
    ["cat-zilker", "p-kai"],
    ["cat-battle-bend", "p-andre"],
  ] as const) {
    meta[courtId] = {
      courtId,
      kingId,
      kingLastPlayedAt: now,
      chat: meta[courtId]?.chat ?? [],
      crownTtlDays: 14,
    };
  }
  return meta;
}

function defaultState(): UpsetState {
  const players = SEED_PLAYERS.map((p) => ({ ...p }));
  return {
    players,
    matches: seedMatches(players),
    courtMeta: seedCourtMeta(players),
    meId: "p-you",
    leagueChat: [],
    dmThreads: [],
    blockedIds: [],
    friendIds: ["p-sean", "p-riley", "p-jia", "p-marcus"],
    reports: [],
    playerReviews: seedReviews(),
    cancelLog: [],
    crownTtlDays: 14,
    seedVersion: SEED_VERSION,
  };
}

function load(): UpsetState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as UpsetState;
    if (!parsed.seedVersion || parsed.seedVersion < SEED_VERSION) {
      return defaultState();
    }
    const base = defaultState();
    // merge seed players (refresh portrait URLs from seed)
    const byId = new Map(
      (Array.isArray(parsed.players) ? parsed.players : []).map((p) => [
        p.id,
        p,
      ]),
    );
    for (const p of SEED_PLAYERS) {
      const existing = byId.get(p.id);
      if (!existing) byId.set(p.id, p);
      else
        byId.set(p.id, {
          ...existing,
          photoUrl: p.photoUrl,
          age: p.age ?? existing.age,
          gender: p.gender ?? existing.gender,
          ethnicity: p.ethnicity ?? existing.ethnicity,
          neighborhood: p.neighborhood ?? existing.neighborhood,
        });
    }
    return {
      ...base,
      ...parsed,
      players: Array.from(byId.values()),
      matches: Array.isArray(parsed.matches) ? parsed.matches : base.matches,
      courtMeta: parsed.courtMeta ?? base.courtMeta,
      dmThreads: Array.isArray(parsed.dmThreads) ? parsed.dmThreads : [],
      blockedIds: Array.isArray(parsed.blockedIds) ? parsed.blockedIds : [],
      friendIds: Array.isArray(parsed.friendIds)
        ? parsed.friendIds
        : base.friendIds,
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      playerReviews: Array.isArray(parsed.playerReviews)
        ? parsed.playerReviews
        : base.playerReviews,
      cancelLog: Array.isArray(parsed.cancelLog) ? parsed.cancelLog : [],
      meId: parsed.meId || "p-you",
      seedVersion: SEED_VERSION,
    };
  } catch {
    return defaultState();
  }
}

let state: UpsetState = defaultState();
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistScheduled = false;

function emit() {
  for (const l of listeners) l();
}

/** Drop heavy tails so localStorage writes stay fast */
function slimForPersist(s: UpsetState): UpsetState {
  return {
    ...s,
    matches: s.matches.slice(0, 100).map((m) => ({
      ...m,
      chat: (m.chat ?? []).slice(-30),
      comments: (m.comments ?? []).slice(-15),
      predictions: m.predictions ?? {},
    })),
    leagueChat: (s.leagueChat ?? []).slice(-40),
    dmThreads: (s.dmThreads ?? []).slice(0, 40).map((t) => ({
      ...t,
      messages: (t.messages ?? []).slice(-40),
    })),
    reports: (s.reports ?? []).slice(-30),
    cancelLog: (s.cancelLog ?? []).slice(-40),
  };
}

function persistNow() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slimForPersist(state)));
  } catch {
    /* quota */
  }
}

/** Never block taps/clicks on sync localStorage writes */
function persist() {
  if (typeof window === "undefined") return;
  if (persistScheduled) return;
  persistScheduled = true;
  const run = () => {
    persistScheduled = false;
    persistTimer = null;
    persistNow();
  };
  // Prefer idle so first paint / gestures win
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 900 });
  } else {
    persistTimer = setTimeout(run, 280);
  }
}

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistScheduled = false;
  persistNow();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPersist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPersist();
  });
}

function setState(updater: (s: UpsetState) => UpsetState) {
  state = updater(state);
  ensureCityRanks(state.players);
  emit();
  persist();
}

function getSnap() {
  return state;
}

// Warm rank cache for avatars (no per-avatar store subscription)
ensureCityRanks(state.players);

export function formatLocalWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function useUpsetStore() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnap,
    getSnap,
  );

  // hydrate after first paint so buttons aren't blocked by JSON.parse
  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    const run = () => {
      try {
        const loaded = load();
        state = loaded;
        ensureCityRanks(state.players);
        emit();
      } catch {
        /* keep default seed */
      }
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 0);
    return () => clearTimeout(t);
  }, []);

  const me = useMemo(
    () => snap.players.find((p) => p.id === snap.meId) ?? snap.players[0]!,
    [snap.players, snap.meId],
  );

  const leaderboard = useMemo(
    () =>
      [...snap.players]
        .filter((p) => p.city === "Austin")
        .sort((a, b) => b.rating - a.rating),
    [snap.players],
  );

  const openMatches = useMemo(
    () =>
      snap.matches
        .filter((m) => m.status === "open")
        .sort((a, b) => a.preferredAt.localeCompare(b.preferredAt)),
    [snap.matches],
  );

  const scheduledMatches = useMemo(
    () =>
      snap.matches
        .filter((m) => m.status === "scheduled" || m.status === "matched")
        .sort((a, b) =>
          (a.scheduledAt ?? a.preferredAt).localeCompare(
            b.scheduledAt ?? b.preferredAt,
          ),
        ),
    [snap.matches],
  );

  const catalogPlayers = useMemo(
    () =>
      snap.players.filter(
        (p) =>
          !p.hideFromCatalog &&
          p.id !== snap.meId &&
          !snap.blockedIds.includes(p.id),
      ),
    [snap.players, snap.meId, snap.blockedIds],
  );

  const playerById = useCallback(
    (id: string) => snap.players.find((p) => p.id === id),
    [snap.players],
  );

  const courtKing = useCallback(
    (courtId: string) => {
      const m = snap.courtMeta[courtId];
      if (!m?.kingId || !isKingActive(m)) return null;
      return snap.players.find((p) => p.id === m.kingId) ?? null;
    },
    [snap.courtMeta, snap.players],
  );

  const ratedAtCourt = useCallback(
    (courtId: string) => {
      return snap.players.filter(
        (p) =>
          p.homeCourtId === courtId || snap.courtMeta[courtId]?.kingId === p.id,
      ).length;
    },
    [snap.players, snap.courtMeta],
  );

  const openAtCourt = useCallback(
    (courtId: string) =>
      snap.matches.filter((m) => m.courtId === courtId && m.status === "open")
        .length,
    [snap.matches],
  );

  const nextGameAtCourt = useCallback(
    (courtId: string) => {
      const list = snap.matches
        .filter(
          (m) =>
            m.courtId === courtId &&
            (m.status === "open" ||
              m.status === "scheduled" ||
              m.status === "matched"),
        )
        .sort((a, b) =>
          (a.scheduledAt ?? a.preferredAt).localeCompare(
            b.scheduledAt ?? b.preferredAt,
          ),
        );
      return list[0] ?? null;
    },
    [snap.matches],
  );

  const createQuickMatch = useCallback(
    (input: {
      courtId: string;
      courtName: string;
      lat: number;
      lon: number;
      preferredAt: string;
      filters: Match["filters"];
      format?: Match["format"];
      notes?: string;
      allowGuestInvites?: boolean;
      guestInviteIds?: string[];
      /** Invite-only: not public; only invited players can join */
      inviteOnly?: boolean;
      stakes?: Match["stakes"];
      hostBringingBall?: boolean;
    }) => {
      const stakes = input.stakes ?? { mode: "fun" as const, dollarsPerPoint: 1 };
      const stakeLine =
        stakes.mode === "charity"
          ? `Feeds Alzheimer's research · $${stakes.fixedPriceDollars ?? stakes.amountDollars ?? 10} donation`
          : stakes.mode === "stakes"
            ? `Peer stakes · $${stakes.fixedPriceDollars ?? "?"} (not the default path)`
            : "Just for fun · rating only";
      const ballLine =
        input.hostBringingBall === true
          ? "Host is bringing a ball."
          : input.hostBringingBall === false
            ? "Host is not bringing a ball."
            : "";
      const invites = (input.guestInviteIds ?? []).filter(
        (id) => id && id !== state.meId,
      );
      const inviteOnly = !!input.inviteOnly;
      const match: Match = {
        id: uid("m"),
        kind: "broadcast",
        hostId: state.meId,
        courtId: input.courtId,
        courtName: input.courtName,
        lat: input.lat,
        lon: input.lon,
        preferredAt: input.preferredAt,
        status: "open",
        format: input.format ?? "1v1",
        allowGuestInvites: input.allowGuestInvites ?? false,
        inviteOnly,
        rosterIds: [],
        guestInviteIds: invites,
        notes: input.notes ?? "",
        hostBringingBall: input.hostBringingBall,
        stakes,
        filters: input.filters,
        predictions: {},
        comments: [],
        chat: [
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `Quick Match posted. ${
              inviteOnly ? "Private match — invite only." : "Public match — anyone can join."
            } ${stakeLine}${ballLine ? ` ${ballLine}` : ""}${
              invites.length
                ? ` · ${invites.length} invite${invites.length === 1 ? "" : "s"} sent.`
                : ""
            }`,
            at: new Date().toISOString(),
            system: true,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, matches: [match, ...s.matches] }));
      return match;
    },
    [],
  );

  const updateMatchNotes = useCallback((matchId: string, notes: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId && m.hostId === s.meId
          ? { ...m, notes: notes.trim() }
          : m,
      ),
    }));
  }, []);

  const acceptMatch = useCallback(
    (matchId: string, opts?: { bringingBall?: boolean }) => {
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m || m.status !== "open" || m.hostId === s.meId) return s;
        // Invite-only: only invited players may join
        if (
          m.inviteOnly &&
          !(m.guestInviteIds ?? []).includes(s.meId)
        ) {
          return s;
        }
        const oppBall = opts?.bringingBall;
        const hostBall = m.hostBringingBall;
        const neither =
          hostBall === false && oppBall === false;
        const chat = [...(m.chat ?? [])];
        chat.push({
          id: uid("sys"),
          authorName: "Upset City",
          text:
            oppBall === true
              ? "Challenger is bringing a ball."
              : oppBall === false
                ? "Challenger is not bringing a ball."
                : "Game locked in.",
          at: new Date().toISOString(),
          system: true,
        });
        if (neither) {
          chat.push({
            id: uid("sys"),
            authorName: "Upset City",
            text: "Neither of you is bringing a basketball — figure it out in chat so tip-off isn’t empty-handed.",
            at: new Date().toISOString(),
            system: true,
          });
        }
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId
              ? {
                  ...x,
                  status: "scheduled" as const,
                  opponentId: s.meId,
                  opponentBringingBall: oppBall,
                  ballNeitherAlerted: neither ? true : x.ballNeitherAlerted,
                  rosterIds: [...new Set([...(x.rosterIds ?? []), s.meId])],
                  scheduledAt: x.preferredAt,
                  acceptedAt: new Date().toISOString(),
                  chat,
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  const tryAcceptRace = useCallback(
    (
      matchId: string,
      opts?: { bringingBall?: boolean },
    ): "ok" | "filled" | "invite_only" => {
      const m = state.matches.find((x) => x.id === matchId);
      if (!m || m.status !== "open") return "filled";
      if (
        m.inviteOnly &&
        !(m.guestInviteIds ?? []).includes(state.meId)
      ) {
        return "invite_only";
      }
      acceptMatch(matchId, opts);
      return "ok";
    },
    [acceptMatch, state.matches, state.meId],
  );

  const setBringingBall = useCallback(
    (matchId: string, bringing: boolean) => {
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m) return s;
        const isHost = m.hostId === s.meId;
        const isOpp = m.opponentId === s.meId;
        if (!isHost && !isOpp) return s;

        const hostBall = isHost ? bringing : m.hostBringingBall;
        const oppBall = isOpp ? bringing : m.opponentBringingBall;
        const neither =
          hostBall === false &&
          oppBall === false &&
          !m.ballNeitherAlerted;

        const chat = [...(m.chat ?? [])];
        if (neither) {
          chat.push({
            id: uid("sys"),
            authorName: "Upset City",
            text: "Neither of you is bringing a basketball — figure it out in chat so tip-off isn’t empty-handed.",
            at: new Date().toISOString(),
            system: true,
          });
        }

        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId
              ? {
                  ...x,
                  hostBringingBall: isHost ? bringing : x.hostBringingBall,
                  opponentBringingBall: isOpp
                    ? bringing
                    : x.opponentBringingBall,
                  ballNeitherAlerted: neither
                    ? true
                    : x.ballNeitherAlerted,
                  chat,
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  /**
   * Cancel rules:
   * - Host + no one joined (open, no opponent): free cancel, no reason, no penalty.
   * - Host + someone joined: reason required → sent to opponent; >3 such host
   *   cancels in 30 days → sportsmanship hit.
   * - Non-host: reason required; ≤24h before tip = late; >3 late in 30 days → hit.
   */
  const cancelMatch = useCallback(
    (
      matchId: string,
      reason: string = "",
    ): {
      ok: true;
      late: boolean;
      sportsmanshipHit: number;
      lateCancelsThisMonth: number;
      kind: "host_empty" | "host_after_join" | "player";
    } | { ok: false; reason: string } => {
      let result:
        | {
            ok: true;
            late: boolean;
            sportsmanshipHit: number;
            lateCancelsThisMonth: number;
            kind: "host_empty" | "host_after_join" | "player";
          }
        | { ok: false; reason: string } = {
        ok: false,
        reason: "Can't cancel this game.",
      };

      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m) {
          result = { ok: false, reason: "Game not found." };
          return s;
        }
        const isHost = m.hostId === s.meId;
        const party =
          isHost ||
          m.opponentId === s.meId ||
          (m.rosterIds ?? []).includes(s.meId);
        if (!party) {
          result = { ok: false, reason: "You're not on this game." };
          return s;
        }
        if (
          m.status === "cancelled" ||
          m.status === "confirmed" ||
          m.status === "disputed"
        ) {
          result = { ok: false, reason: "This game can't be cancelled." };
          return s;
        }

        const someoneJoined =
          !!m.opponentId ||
          (m.rosterIds ?? []).some((id) => id !== m.hostId) ||
          m.status === "matched" ||
          m.status === "scheduled";

        if (isHost && !someoneJoined) {
          const meP = s.players.find((p) => p.id === s.meId);
          result = {
            ok: true,
            late: false,
            sportsmanshipHit: 0,
            lateCancelsThisMonth: 0,
            kind: "host_empty",
          };
          return {
            ...s,
            matches: s.matches.map((x) =>
              x.id !== matchId
                ? x
                : {
                    ...x,
                    status: "cancelled" as const,
                    cancelledBy: s.meId,
                    cancelReason: "Listing closed by host (no one had joined).",
                    cancelledAt: new Date().toISOString(),
                    cancelWasLate: false,
                    chat: [
                      ...x.chat,
                      {
                        id: uid("sys"),
                        authorName: "Upset City",
                        authorId: s.meId,
                        text: `${meP?.name ?? "Host"} closed this open game. No one had joined — no penalty.`,
                        at: new Date().toISOString(),
                        system: true,
                      },
                    ],
                  },
            ),
          };
        }

        const body = reason.trim();
        if (body.length < 3) {
          result = {
            ok: false,
            reason: isHost
              ? "Someone already joined — write a reason so they know why."
              : "Write a short reason so the host knows why.",
          };
          return s;
        }

        const tip = new Date(m.scheduledAt ?? m.preferredAt).getTime();
        const hoursUntil = (tip - Date.now()) / 3600e3;
        const late = !isHost && hoursUntil <= 24;
        const monthAgo = Date.now() - 30 * 86400e3;

        const kind: "host_after_join" | "player" = isHost
          ? "host_after_join"
          : "player";

        const priorCounted = (s.cancelLog ?? []).filter((c) => {
          if (c.playerId !== s.meId) return false;
          if (new Date(c.at).getTime() < monthAgo) return false;
          if (isHost) return c.kind === "host_after_join";
          return c.kind === "player" && c.late;
        }).length;

        let hit = 0;
        if (isHost) {
          if (priorCounted >= 3) hit = 0.15;
        } else if (late && priorCounted >= 3) {
          hit = 0.15;
        }

        const meP = s.players.find((p) => p.id === s.meId);
        const otherId = isHost ? m.opponentId : m.hostId;
        const otherName =
          s.players.find((p) => p.id === otherId)?.name ?? "them";

        const entry: CancelLogEntry = {
          id: uid("cx"),
          playerId: s.meId,
          matchId,
          at: new Date().toISOString(),
          late: isHost ? false : late,
          reason: body,
          sportsmanshipHit: hit,
          kind,
        };

        const countedThisMonth = priorCounted + 1;

        result = {
          ok: true,
          late: isHost ? false : late,
          sportsmanshipHit: hit,
          lateCancelsThisMonth: countedThisMonth,
          kind,
        };

        const notifyLine = isHost
          ? `Host cancelled after you joined: ${body}`
          : `${meP?.name ?? "Someone"} cancelled${late ? " (within 24h)" : ""}: ${body}`;

        const policyLine = isHost
          ? hit > 0
            ? `Host cancel #${countedThisMonth} this month (after someone joined) — sportsmanship −${hit.toFixed(1)}. ${otherName} was notified.`
            : `Host cancel after join logged (${countedThisMonth}/3 free this month before sportsmanship is hit). ${otherName} was notified.`
          : late
            ? hit > 0
              ? `Late cancel #${countedThisMonth} this month — sportsmanship −${hit.toFixed(1)}.`
              : `Late cancel logged (${countedThisMonth}/3 free this month before sportsmanship is hit).`
            : "Cancelled with 24h+ notice — no penalty.";

        return {
          ...s,
          cancelLog: [...(s.cancelLog ?? []), entry],
          players: s.players.map((p) =>
            p.id === s.meId && hit > 0
              ? {
                  ...p,
                  sportsmanship: Math.max(
                    1,
                    Math.round((p.sportsmanship - hit) * 10) / 10,
                  ),
                }
              : p,
          ),
          matches: s.matches.map((x) =>
            x.id !== matchId
              ? x
              : {
                  ...x,
                  status: "cancelled" as const,
                  cancelledBy: s.meId,
                  cancelReason: body,
                  cancelledAt: new Date().toISOString(),
                  cancelWasLate: isHost ? false : late,
                  chat: [
                    ...x.chat,
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      authorId: s.meId,
                      text: notifyLine,
                      at: new Date().toISOString(),
                      system: true,
                    },
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text: policyLine,
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                },
          ),
        };
      });

      return result;
    },
    [],
  );

  /**
   * Bind signed-in account → league player (me).
   * Updates name / email / photo; keeps p-you id for seed continuity unless
   * another player already claims this authUserId.
   */
  const syncAuthIdentity = useCallback(
    (user: {
      id: string;
      displayName?: string | null;
      primaryEmail?: string | null;
      profileImageUrl?: string | null;
    } | null) => {
      if (!user?.id) return;
      setState((s) => {
        const byAuth = s.players.find((p) => p.authUserId === user.id);
        const byEmail = user.primaryEmail
          ? s.players.find(
              (p) =>
                p.email?.toLowerCase() === user.primaryEmail!.toLowerCase(),
            )
          : undefined;
        const targetId = byAuth?.id ?? byEmail?.id ?? s.meId ?? "p-you";
        const display =
          (user.displayName && user.displayName.trim()) ||
          (user.primaryEmail
            ? user.primaryEmail.split("@")[0]
            : undefined);
        const handleBase = (display ?? "player")
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "")
          .slice(0, 16);
        return {
          ...s,
          meId: targetId,
          players: s.players.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  authUserId: user.id,
                  email: user.primaryEmail ?? p.email,
                  name: display ?? p.name,
                  handle: p.handle === "you" || !p.handle
                    ? handleBase || p.handle
                    : p.handle,
                  photoUrl: user.profileImageUrl || p.photoUrl,
                }
              : p,
          ),
        };
      });
    },
    [],
  );

  const enterScore = useCallback((matchId: string, scores: MatchGame[]) => {
    setState((s) => {
      const me = s.players.find((p) => p.id === s.meId);
      return {
        ...s,
        matches: s.matches.map((m) =>
          m.id === matchId
            ? {
                ...m,
                scores,
                scoreEnteredBy: s.meId,
                scoreConfirmedBy: undefined,
                status: "played_pending" as const,
                chat: [
                  ...(m.chat ?? []),
                  {
                    id: uid("sys"),
                    authorName: "Upset City",
                    text: `${me?.name ?? "Player"} submitted scores (${scores.map((g) => `${g.a}–${g.b}`).join(", ")}). Opponent must confirm before ratings lock.`,
                    at: new Date().toISOString(),
                    system: true,
                  },
                ],
              }
            : m,
        ),
      };
    });
  }, []);

  const confirmScore = useCallback((matchId: string, dispute = false) => {
    setState((s) => {
      const m = s.matches.find((x) => x.id === matchId);
      if (!m || !m.scores || !m.opponentId) return s;
      // Dual-confirm: only the non-enterer can confirm
      if (!dispute && m.scoreEnteredBy === s.meId) return s;
      if (!dispute && m.scoreEnteredBy && m.scoreEnteredBy !== s.meId) {
        // ok
      } else if (!dispute && !m.scoreEnteredBy) {
        return s;
      }

      if (dispute) {
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId
              ? {
                  ...x,
                  status: "disputed" as const,
                  scoreConfirmedBy: undefined,
                  chat: [
                    ...(x.chat ?? []),
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text: "Score disputed — ratings not updated. Agree and re-submit.",
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                }
              : x,
          ),
        };
      }

      const host = s.players.find((p) => p.id === m.hostId);
      const opp = s.players.find((p) => p.id === m.opponentId);
      if (!host || !opp) return s;

      const result = rateSeries(
        { rating: host.rating, gamesPlayed: host.gamesPlayed },
        { rating: opp.rating, gamesPlayed: opp.gamesPlayed },
        m.scores,
      );

      const hostWon =
        m.scores.reduce((n, g) => n + (g.a > g.b ? 1 : 0), 0) >
        m.scores.reduce((n, g) => n + (g.b > g.a ? 1 : 0), 0);

      const players = s.players.map((p) => {
        if (p.id === host.id) {
          return {
            ...p,
            rating: result.aNew,
            gamesPlayed: p.gamesPlayed + 1,
            wins: p.wins + (hostWon ? 1 : 0),
            losses: p.losses + (hostWon ? 0 : 1),
            streak: hostWon ? Math.max(0, p.streak) + 1 : 0,
            lastPlayedAt: new Date().toISOString(),
            pointsScored:
              p.pointsScored + m.scores!.reduce((n, g) => n + g.a, 0),
            pointsAllowed:
              p.pointsAllowed + m.scores!.reduce((n, g) => n + g.b, 0),
            weeklyWins: p.weeklyWins + (hostWon ? 1 : 0),
            weeklyLosses: p.weeklyLosses + (hostWon ? 0 : 1),
          };
        }
        if (p.id === opp.id) {
          return {
            ...p,
            rating: result.bNew,
            gamesPlayed: p.gamesPlayed + 1,
            wins: p.wins + (hostWon ? 0 : 1),
            losses: p.losses + (hostWon ? 1 : 0),
            streak: hostWon ? 0 : Math.max(0, p.streak) + 1,
            lastPlayedAt: new Date().toISOString(),
            pointsScored:
              p.pointsScored + m.scores!.reduce((n, g) => n + g.b, 0),
            pointsAllowed:
              p.pointsAllowed + m.scores!.reduce((n, g) => n + g.a, 0),
            weeklyWins: p.weeklyWins + (hostWon ? 0 : 1),
            weeklyLosses: p.weeklyLosses + (hostWon ? 1 : 0),
          };
        }
        return p;
      });

      const winnerId = hostWon ? host.id : opp.id;
      const settledStakes =
        m.stakes && m.stakes.mode !== "fun"
          ? {
              ...computeStakePayout(
                m.stakes,
                m.scores,
                m.hostId,
                m.opponentId!,
              ),
              paymentStatus: "pending" as const,
              payDeadlineAt: new Date(Date.now() + 48 * 3600e3).toISOString(),
            }
          : m.stakes;

      // Production ledger: open payment intent when money/charity is on the line
      if (
        settledStakes &&
        settledStakes.mode !== "fun" &&
        settledStakes.amountDollars != null &&
        settledStakes.loserId
      ) {
        try {
          createPaymentIntent({
            matchId: m.id,
            kind: settledStakes.mode === "charity" ? "charity" : "peer",
            amountDollars: settledStakes.amountDollars,
            payerId: settledStakes.loserId,
            payeeId:
              settledStakes.mode === "stakes"
                ? settledStakes.winnerId
                : undefined,
            note:
              settledStakes.mode === "charity"
                ? "Alzheimer's research pledge"
                : "Peer stake settlement",
          });
        } catch {
          /* ignore */
        }
      }

      const stakeNote =
        settledStakes &&
        settledStakes.mode !== "fun" &&
        settledStakes.amountDollars != null
          ? settledStakes.mode === "charity"
            ? ` · Loser donates ${formatMoney(settledStakes.amountDollars)} to charity`
            : ` · Loser owes ${formatMoney(settledStakes.amountDollars)}`
          : "";

      const courtMeta = { ...s.courtMeta };
      const prev = courtMeta[m.courtId] ?? {
        courtId: m.courtId,
        chat: [],
        crownTtlDays: s.crownTtlDays,
      };
      courtMeta[m.courtId] = {
        ...prev,
        kingId: winnerId,
        kingLastPlayedAt: new Date().toISOString(),
        chat: [
          ...prev.chat,
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `Result dual-confirmed. ${hostWon ? host.name : opp.name} wins.${stakeNote}`,
            at: new Date().toISOString(),
            system: true,
          },
        ],
      };

      return {
        ...s,
        players,
        courtMeta,
        matches: s.matches.map((x) =>
          x.id === matchId
            ? {
                ...x,
                status: "confirmed" as const,
                scoreConfirmedBy: s.meId,
                confirmedBy: s.meId,
                ratingDeltaHost: result.aDelta,
                ratingDeltaOpp: result.bDelta,
                stakes: settledStakes,
                chat: [
                  ...(x.chat ?? []),
                  {
                    id: uid("sys"),
                    authorName: "Upset City",
                    text: "Both sides locked. Ratings updated.",
                    at: new Date().toISOString(),
                    system: true,
                  },
                ],
              }
            : x,
        ),
      };
    });
  }, []);

  const markStakeSettled = useCallback(
    (matchId: string, method?: NonNullable<Match["stakes"]>["settleMethod"]) => {
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (m?.stakes && !m.stakes.settled && m.stakes.mode !== "fun") {
          const amount =
            m.stakes.amountDollars ?? m.stakes.fixedPriceDollars ?? 0;
          const loser = s.players.find((p) => p.id === m.stakes?.loserId);
          try {
            if (m.stakes.mode === "charity" && amount > 0 && loser) {
              useCampaign.getState().addDonation({
                amount,
                playerId: loser.id,
                playerName: loser.name,
                matchId: m.id,
                note: `${m.format === "horse" ? "HORSE" : "1v1"} · ${m.courtName}`,
              });
              markPaymentSettled(m.id, method ?? "charity", {
                amountDollars: amount,
                payerId: loser.id,
                kind: "charity",
              });
              useMediaFeed.getState().createPost({
                authorId: "system",
                authorName: "Upset City",
                text: `+$${amount} for Alzheimer's — ${loser.name} completed a gift from ${m.courtName}.`,
                mentionedIds: [loser.id],
              });
            } else if (m.stakes.mode === "stakes") {
              markPaymentSettled(m.id, method ?? "peer", {
                amountDollars: amount,
                payerId: m.stakes.loserId ?? s.meId,
                kind: "peer",
              });
            }
          } catch {
            /* ignore */
          }
        }
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId && x.stakes
              ? {
                  ...x,
                  stakes: {
                    ...x.stakes,
                    settled: true,
                    settledAt: new Date().toISOString(),
                    settleMethod: method ?? x.stakes.settleMethod,
                    paymentStatus: "settled",
                  },
                  chat: [
                    ...(x.chat ?? []),
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text:
                        x.stakes.mode === "charity"
                          ? "Charity donation marked complete — added to the Austin $50k goal. Thank you."
                          : `Stake marked settled${method ? ` via ${method}` : ""}.`,
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  const updateMyPayHandles = useCallback(
    (handles: {
      payCashApp?: string;
      payVenmo?: string;
      payZelle?: string;
    }) => {
      setState((s) => ({
        ...s,
        players: s.players.map((p) =>
          p.id === s.meId
            ? {
                ...p,
                payCashApp: handles.payCashApp?.trim() || undefined,
                payVenmo: handles.payVenmo?.trim() || undefined,
                payZelle: handles.payZelle?.trim() || undefined,
              }
            : p,
        ),
      }));
    },
    [],
  );

  /** Loser asks for more time — community + winner see the note */
  const requestStakeExtension = useCallback(
    (matchId: string, note: string) => {
      const text = note.trim();
      if (text.length < 8) {
        return { ok: false as const, reason: "Tell us what’s going on (a short note)." };
      }
      let posted = false;
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m?.stakes || m.stakes.mode === "fun" || m.stakes.settled) {
          return s;
        }
        if (m.stakes.loserId !== s.meId) {
          return s;
        }
        const loser = s.players.find((p) => p.id === s.meId);
        const amount = m.stakes.amountDollars ?? m.stakes.fixedPriceDollars;
        const newDeadline = new Date(
          Math.max(
            Date.now() + 48 * 3600e3,
            m.stakes.payDeadlineAt
              ? new Date(m.stakes.payDeadlineAt).getTime() + 48 * 3600e3
              : Date.now() + 48 * 3600e3,
          ),
        ).toISOString();
        posted = true;
        // community notice
        try {
          useMediaFeed.getState().createPost({
            authorId: "system",
            authorName: "Upset City",
            text: `⏳ More time requested — ${loser?.name ?? "A player"} needs extra time to settle ${amount != null ? `$${amount}` : "stakes"} from ${m.courtName}. Note: “${text.slice(0, 160)}” · We work with people who communicate.`,
          });
        } catch {
          /* ignore */
        }
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId && x.stakes
              ? {
                  ...x,
                  stakes: {
                    ...x.stakes,
                    paymentStatus: "extension_requested",
                    extensionNote: text,
                    extensionRequestedAt: new Date().toISOString(),
                    payDeadlineAt: newDeadline,
                  },
                  chat: [
                    ...(x.chat ?? []),
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text: `Extension requested: ${text}`,
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                }
              : x,
          ),
        };
      });
      if (!posted) {
        return { ok: false as const, reason: "Couldn’t request extension on this game." };
      }
      return { ok: true as const };
    },
    [],
  );

  /**
   * Winner reports non-payment → permanent exile + public league notice.
   */
  const reportStakeUnpaid = useCallback((matchId: string) => {
    let result: { ok: true } | { ok: false; reason: string } = {
      ok: false,
      reason: "Couldn’t file report.",
    };
    setState((s) => {
      const m = s.matches.find((x) => x.id === matchId);
      if (!m?.stakes || m.stakes.mode === "fun") {
        result = { ok: false, reason: "Not a stakes/charity game." };
        return s;
      }
      if (m.stakes.settled || m.stakes.paymentStatus === "exiled") {
        result = { ok: false, reason: "Already settled or already exiled." };
        return s;
      }
      if (m.stakes.winnerId !== s.meId && m.stakes.mode === "stakes") {
        result = { ok: false, reason: "Only the winner can report non-payment." };
        return s;
      }
      // charity: either party can report if loser is the other - actually winner of series
      if (m.stakes.winnerId !== s.meId) {
        result = { ok: false, reason: "Only the winner can report non-payment." };
        return s;
      }
      const loserId = m.stakes.loserId;
      if (!loserId) {
        result = { ok: false, reason: "No loser on file." };
        return s;
      }
      const loser = s.players.find((p) => p.id === loserId);
      const winner = s.players.find((p) => p.id === m.stakes!.winnerId);
      const amount = m.stakes.amountDollars ?? m.stakes.fixedPriceDollars;
      const reason =
        m.stakes.mode === "charity"
          ? `Did not complete charity donation (${amount != null ? `$${amount}` : "owed"}) after ${m.courtName}`
          : `Did not pay stakes (${amount != null ? `$${amount}` : "owed"}) to ${winner?.name ?? "winner"} after ${m.courtName}`;

      try {
        useMediaFeed.getState().createPost({
          authorId: "system",
          authorName: "Upset City",
          text: `🚫 EXILED FROM THE LEAGUE — ${loser?.name ?? "A player"} (@${loser?.handle ?? "player"}) failed to settle ${amount != null ? `$${amount}` : "an amount"} from a confirmed game at ${m.courtName}. Unpaid stakes/charity = permanent exile. The community has been notified. Pay what you owe. Communicate if you need time — silence is exile.`,
          mentionedIds: loserId ? [loserId] : [],
        });
      } catch {
        /* ignore */
      }

      result = { ok: true };
      return {
        ...s,
        players: s.players.map((p) =>
          p.id === loserId
            ? {
                ...p,
                exiled: true,
                exiledAt: new Date().toISOString(),
                exiledReason: reason,
                openToChallenges: false,
                hideFromCatalog: true,
                availability: "offline" as const,
              }
            : p,
        ),
        matches: s.matches.map((x) => {
          if (x.id === matchId && x.stakes) {
            return {
              ...x,
              stakes: {
                ...x.stakes,
                paymentStatus: "exiled",
                reportedUnpaidAt: new Date().toISOString(),
                reportedById: s.meId,
              },
              chat: [
                ...(x.chat ?? []),
                {
                  id: uid("sys"),
                  authorName: "Upset City",
                  text: "Non-payment reported. Loser is permanently exiled from the league.",
                  at: new Date().toISOString(),
                  system: true,
                },
              ],
            };
          }
          // cancel open listings by exiled player
          if (
            x.hostId === loserId &&
            (x.status === "open" || x.status === "matched")
          ) {
            return {
              ...x,
              status: "cancelled" as const,
              cancelReason: "Host exiled for unpaid stakes",
              cancelledAt: new Date().toISOString(),
              cancelledBy: "system",
            };
          }
          return x;
        }),
      };
    });
    return result;
  }, []);

  const predict = useCallback((matchId: string, winnerId: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              predictions: { ...m.predictions, [s.meId]: winnerId },
            }
          : m,
      ),
    }));
  }, []);

  const commentOnMatch = useCallback((matchId: string, text: string) => {
    const t = text.trim();
    if (!t) return;
    setState((s) => {
      const me = s.players.find((p) => p.id === s.meId);
      return {
        ...s,
        matches: s.matches.map((m) =>
          m.id === matchId
            ? {
                ...m,
                comments: [
                  ...m.comments,
                  {
                    id: uid("c"),
                    authorId: s.meId,
                    authorName: me?.name ?? "You",
                    text: t,
                    at: new Date().toISOString(),
                  },
                ],
              }
            : m,
        ),
      };
    });
  }, []);

  const postCourtChat = useCallback((courtId: string, text: string) => {
    const t = text.trim();
    if (!t) return;
    setState((s) => {
      const me = s.players.find((p) => p.id === s.meId);
      const prev = s.courtMeta[courtId] ?? {
        courtId,
        chat: [],
        crownTtlDays: s.crownTtlDays,
      };
      const msg: ChatMessage = {
        id: uid("chat"),
        authorId: s.meId,
        authorName: me?.name ?? "You",
        text: t,
        at: new Date().toISOString(),
      };
      return {
        ...s,
        courtMeta: {
          ...s.courtMeta,
          [courtId]: { ...prev, chat: [...prev.chat, msg] },
        },
      };
    });
  }, []);


  /** Find-a-player mutual accept → locked scheduled 1v1 */
  /** Parties can re-pick court after lock (chat + agree) */
  const updateMatchCourt = useCallback(
    (
      matchId: string,
      court: { id: string; name: string; lat: number; lon: number },
    ): { ok: true } | { ok: false; reason: string } => {
      const meId = state.meId;
      let err: string | null = null;
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m) {
          err = "Game not found.";
          return s;
        }
        if (m.hostId !== meId && m.opponentId !== meId) {
          err = "Not your game.";
          return s;
        }
        if (
          m.status !== "scheduled" &&
          m.status !== "matched" &&
          m.status !== "open"
        ) {
          err = "Court is locked after tip-off.";
          return s;
        }
        if (m.courtId === court.id) return s;
        const me = s.players.find((p) => p.id === meId);
        const chat = [
          ...(m.chat ?? []),
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `${me?.name?.split(" ")[0] ?? "Player"} moved the game to ${court.name}. Chat if you need a different spot.`,
            at: new Date().toISOString(),
            system: true,
          },
        ];
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId
              ? {
                  ...x,
                  courtId: court.id,
                  courtName: court.name,
                  lat: court.lat,
                  lon: court.lon,
                  chat,
                }
              : x,
          ),
        };
      });
      if (err) return { ok: false, reason: err };
      return { ok: true };
    },
    [],
  );

  const createHoopLockedMatch = useCallback(
    (input: {
      opponentId: string;
      courtId: string;
      courtName: string;
      lat: number;
      lon: number;
      preferredAt: string;
      notes?: string;
      hostBringingBall?: boolean;
      opponentBringingBall?: boolean;
      /** Migrated Match Mode chat (incl. prior proposals) */
      seedChat?: import("@/lib/upset/types").ChatMessage[];
    }): { ok: true; match: Match } | { ok: false; reason: string } => {
      const me = state.players.find((p) => p.id === state.meId);
      const opp = state.players.find((p) => p.id === input.opponentId);
      if (!me || !opp) return { ok: false, reason: "Player not found." };
      if (me.exiled || opp.exiled)
        return { ok: false, reason: "Can't book — exile on the books." };

      const already = state.matches.some((m) => {
        if (
          m.status !== "scheduled" &&
          m.status !== "matched" &&
          m.status !== "played_pending"
        )
          return false;
        return (
          (m.hostId === me.id && m.opponentId === opp.id) ||
          (m.hostId === opp.id && m.opponentId === me.id)
        );
      });
      if (already)
        return { ok: false, reason: "You already have a run locked with them." };

      const when = new Date(input.preferredAt);
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
        return { ok: false, reason: "Pick a time in the future." };
      }

      const match: Match = {
        id: uid("m"),
        kind: "challenge",
        format: "1v1",
        hostId: me.id,
        opponentId: opp.id,
        courtId: input.courtId,
        courtName: input.courtName,
        lat: input.lat,
        lon: input.lon,
        preferredAt: input.preferredAt,
        scheduledAt: input.preferredAt,
        status: "scheduled",
        hostBringingBall: input.hostBringingBall,
        opponentBringingBall: input.opponentBringingBall,
        notes:
          input.notes ??
          "Hoop Now · Best of 3 to 11 · win by 2 · call your own fouls",
        filters: {
          heightMinIn: 60,
          heightMaxIn: 90,
          ratingMin: Math.min(me.rating, opp.rating) - 400,
          ratingMax: Math.max(me.rating, opp.rating) + 400,
          sportsmanshipMin: 3,
          radiusMiles: 25,
        },
        predictions: {},
        comments: [],
        chat: [
          ...(input.seedChat ?? []),
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `Scheduled: ${me.name.split(" ")[0]} vs ${opp.name.split(" ")[0]} · ${input.courtName}. Change court or time only by proposal — the other person must approve in chat.`,
            at: new Date().toISOString(),
            system: true,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, matches: [match, ...s.matches] }));
      return { ok: true, match };
    },
    [],
  );

  /** Propose court/time change on a scheduled game — needs opponent approve in chat */
  const submitMatchChangeProposal = useCallback(
    (input: {
      matchId: string;
      courtId: string;
      courtName: string;
      lat: number;
      lon: number;
      whenIso: string;
      whenLabel: string;
    }): { ok: true } | { ok: false; reason: string } => {
      const me = state.players.find((p) => p.id === state.meId);
      if (!me) return { ok: false, reason: "Not signed in." };
      let err: string | null = null;
      setState((s) => {
        const m = s.matches.find((x) => x.id === input.matchId);
        if (!m) {
          err = "Game not found.";
          return s;
        }
        if (m.hostId !== me.id && m.opponentId !== me.id) {
          err = "Not your game.";
          return s;
        }
        if (m.status !== "scheduled" && m.status !== "matched") {
          err = "Can only change court/time before tip-off.";
          return s;
        }
        const when = new Date(input.whenIso);
        if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
          err = "Pick a future tip-off.";
          return s;
        }
        const who = me.name.split(" ")[0];
        const chat = (m.chat ?? []).map((c) =>
          c.kind === "proposal" && c.proposal?.status === "pending"
            ? {
                ...c,
                proposal: { ...c.proposal, status: "superseded" as const },
                text: c.text.replace("Needs approval", "Superseded"),
              }
            : c,
        );
        chat.push({
          id: uid("prop"),
          authorId: me.id,
          authorName: me.name,
          text: `${who} proposed: ${input.courtName} · ${input.whenLabel}. Needs approval.`,
          at: new Date().toISOString(),
          kind: "proposal",
          proposal: {
            courtId: input.courtId,
            courtName: input.courtName,
            lat: input.lat,
            lon: input.lon,
            whenIso: input.whenIso,
            whenLabel: input.whenLabel,
            proposedById: me.id,
            proposedByName: me.name,
            status: "pending",
          },
        });
        chat.push({
          id: uid("sys"),
          authorName: "Upset City",
          text: "Approve in chat to move the game — or chat and send a new plan.",
          at: new Date().toISOString(),
          system: true,
        });
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === input.matchId ? { ...x, chat } : x,
          ),
        };
      });
      if (err) return { ok: false, reason: err };
      return { ok: true };
    },
    [state.meId, state.players, state.matches],
  );

  const approveMatchChangeProposal = useCallback(
    (
      matchId: string,
      msgId: string,
    ): { ok: true } | { ok: false; reason: string } => {
      const meId = state.meId;
      let err: string | null = null;
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m) {
          err = "Game not found.";
          return s;
        }
        if (m.hostId !== meId && m.opponentId !== meId) {
          err = "Not your game.";
          return s;
        }
        const msg = (m.chat ?? []).find((c) => c.id === msgId);
        if (!msg?.proposal || msg.proposal.status !== "pending") {
          err = "No pending change to approve.";
          return s;
        }
        const prop = msg.proposal;
        const chat = (m.chat ?? []).map((c) =>
          c.id === msgId && c.proposal
            ? {
                ...c,
                proposal: { ...c.proposal, status: "approved" as const },
                text: c.text.replace("Needs approval", "Approved ✓"),
              }
            : c,
        );
        chat.push({
          id: uid("sys"),
          authorName: "Upset City",
          text: `Plan locked · ${prop.courtName} · ${prop.whenLabel}.`,
          at: new Date().toISOString(),
          system: true,
        });
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId
              ? {
                  ...x,
                  courtId: prop.courtId,
                  courtName: prop.courtName,
                  lat: prop.lat,
                  lon: prop.lon,
                  preferredAt: prop.whenIso,
                  scheduledAt: prop.whenIso,
                  chat,
                }
              : x,
          ),
        };
      });
      if (err) return { ok: false, reason: err };
      return { ok: true };
    },
    [state.meId, state.matches],
  );

  const challengePlayer = useCallback(
    (
      targetId: string,
      input: {
        courtId: string;
        courtName: string;
        lat: number;
        lon: number;
        preferredAt: string;
        notes?: string;
      },
    ): { ok: true; match: Match } | { ok: false; reason: string } => {
      const target = state.players.find((p) => p.id === targetId);
      const me = state.players.find((p) => p.id === state.meId);
      if (!target || !me) return { ok: false, reason: "Player not found." };
      if (!target.openToChallenges)
        return { ok: false, reason: "They aren’t open to challenges." };
      if (state.blockedIds.includes(targetId))
        return { ok: false, reason: "You’ve blocked this player." };

      const alreadyBooked = state.matches.some((m) => {
        if (
          m.status !== "scheduled" &&
          m.status !== "matched" &&
          m.status !== "open"
        )
          return false;
        return (
          (m.hostId === state.meId && m.opponentId === targetId) ||
          (m.hostId === targetId && m.opponentId === state.meId)
        );
      });
      if (alreadyBooked) {
        return {
          ok: false,
          reason: "You already have a game scheduled with them.",
        };
      }

      // Prefer an existing open listing from them — challenger still has to Join.
      const theirOpen = state.matches.find(
        (m) => m.hostId === targetId && m.status === "open",
      );
      if (theirOpen) {
        return { ok: true, match: theirOpen };
      }

      // Open challenge listing hosted by the target so YOU are not auto-booked.
      // You open the detail screen and tap Join if it looks like a fit.
      const match: Match = {
        id: uid("m"),
        kind: "challenge",
        format: "1v1",
        hostId: targetId,
        courtId: input.courtId,
        courtName: input.courtName,
        lat: input.lat,
        lon: input.lon,
        preferredAt: input.preferredAt,
        status: "open",
        notes:
          input.notes ??
          `Open for a rated 1v1 · Best of 3 games · to 11 · win by 2 · call your own fouls`,
        filters: {
          heightMinIn: 60,
          heightMaxIn: 90,
          ratingMin: Math.min(me.rating, target.rating) - 500,
          ratingMax: Math.max(me.rating, target.rating) + 500,
          sportsmanshipMin: 3,
          radiusMiles: 25,
        },
        predictions: {},
        comments: [],
        chat: [
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `${me.name} pulled this up from Media — Join only if you want the run.`,
            at: new Date().toISOString(),
            system: true,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, matches: [match, ...s.matches] }));
      return { ok: true, match };
    },
    [],
  );

  const sendDm = useCallback(
    (
      toId: string,
      text: string,
    ): { ok: true } | { ok: false; reason: string } => {
      const t = text.trim();
      if (!t) return { ok: false, reason: "Empty message." };
      const to = state.players.find((p) => p.id === toId);
      const me = state.players.find((p) => p.id === state.meId);
      if (!to || !me) return { ok: false, reason: "Player not found." };
      if (state.blockedIds.includes(toId))
        return { ok: false, reason: "Blocked." };

      setState((s) => {
        const existing = s.dmThreads.find(
          (th) =>
            th.participantIds.includes(s.meId) &&
            th.participantIds.includes(toId),
        );
        const msg: ChatMessage = {
          id: uid("dm"),
          authorId: s.meId,
          authorName: me.name,
          text: t,
          at: new Date().toISOString(),
        };
        if (existing) {
          return {
            ...s,
            dmThreads: s.dmThreads.map((th) =>
              th.id === existing.id
                ? {
                    ...th,
                    messages: [...th.messages, msg],
                    updatedAt: msg.at,
                  }
                : th,
            ),
          };
        }
        const thread: DirectThread = {
          id: uid("th"),
          participantIds: [s.meId, toId],
          isRequest: true,
          messages: [msg],
          updatedAt: msg.at,
        };
        return { ...s, dmThreads: [thread, ...s.dmThreads] };
      });
      return { ok: true };
    },
    [],
  );

  const acceptDmRequest = useCallback((threadId: string) => {
    setState((s) => ({
      ...s,
      dmThreads: s.dmThreads.map((th) =>
        th.id === threadId ? { ...th, isRequest: false } : th,
      ),
    }));
  }, []);

  const blockPlayer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      blockedIds: s.blockedIds.includes(id)
        ? s.blockedIds
        : [...s.blockedIds, id],
    }));
  }, []);

  const addFriend = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      friendIds: (s.friendIds ?? []).includes(id)
        ? (s.friendIds ?? [])
        : [...(s.friendIds ?? []), id],
    }));
  }, []);

  const removeFriend = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      friendIds: (s.friendIds ?? []).filter((x) => x !== id),
    }));
  }, []);

  const reportPlayer = useCallback((id: string, reason: string) => {
    setState((s) => ({
      ...s,
      reports: [
        ...s.reports,
        {
          id: uid("rep"),
          targetId: id,
          reason,
          at: new Date().toISOString(),
        },
      ],
    }));
  }, []);


  const postMatchChat = useCallback((matchId: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    setState((s) => {
      const meP = s.players.find((p) => p.id === s.meId);
      return {
        ...s,
        matches: s.matches.map((m) =>
          m.id !== matchId
            ? m
            : {
                ...m,
                chat: [
                  ...m.chat,
                  {
                    id: uid("mc"),
                    authorId: s.meId,
                    authorName: meP?.name ?? "You",
                    text: body,
                    at: new Date().toISOString(),
                  },
                ],
              },
        ),
      };
    });
  }, []);

  const inviteToMatch = useCallback(
    (
      matchId: string,
      playerId: string,
    ): { ok: true } | { ok: false; reason: string } => {
      let result: { ok: true } | { ok: false; reason: string } = {
        ok: false,
        reason: "Game not found.",
      };
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m) {
          result = { ok: false, reason: "Game not found." };
          return s;
        }
        if (
          m.status !== "open" &&
          m.status !== "matched" &&
          m.status !== "scheduled"
        ) {
          result = { ok: false, reason: "Game is closed." };
          return s;
        }
        const isHost = m.hostId === s.meId;
        const onRoster =
          m.rosterIds?.includes(s.meId) || m.opponentId === s.meId;
        if (!isHost && !m.allowGuestInvites) {
          result = {
            ok: false,
            reason: "Host isn’t allowing guest invites.",
          };
          return s;
        }
        if (!isHost && !onRoster) {
          result = {
            ok: false,
            reason: "Join the game before inviting friends.",
          };
          return s;
        }
        if (
          playerId === m.hostId ||
          m.rosterIds?.includes(playerId) ||
          m.opponentId === playerId
        ) {
          result = { ok: false, reason: "Already in this game." };
          return s;
        }
        if (m.guestInviteIds?.includes(playerId)) {
          result = { ok: true };
          return s;
        }
        const inviter =
          s.players.find((p) => p.id === s.meId)?.name ?? "Someone";
        const invitee =
          s.players.find((p) => p.id === playerId)?.name ?? "a player";
        result = { ok: true };
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id !== matchId
              ? x
              : {
                  ...x,
                  guestInviteIds: [...(x.guestInviteIds ?? []), playerId],
                  chat: [
                    ...x.chat,
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text: `${inviter} invited ${invitee}.`,
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                },
          ),
        };
      });
      return result;
    },
    [],
  );

  const respondGuestInvite = useCallback(
    (matchId: string, accept: boolean) => {
      setState((s) => ({
        ...s,
        matches: s.matches.map((m) => {
          if (m.id !== matchId) return m;
          const pending = (m.guestInviteIds ?? []).filter((id) => id !== s.meId);
          if (!accept) return { ...m, guestInviteIds: pending };
          return {
            ...m,
            guestInviteIds: pending,
            rosterIds: [...(m.rosterIds ?? []), s.meId],
          };
        }),
      }));
    },
    [],
  );

  return {
    ...snap,
    me,
    leaderboard,
    openMatches,
    scheduledMatches,
    catalogPlayers,
    // aliases used by older panels
    openGames: openMatches,
    playerById,
    courtKing,
    ratedAtCourt,
    openAtCourt,
    nextGameAtCourt,
    createQuickMatch,
    updateMatchNotes,
    acceptMatch,
    tryAcceptRace,
    setBringingBall,
    cancelMatch,
    cancelGame: cancelMatch,
    joinGame: tryAcceptRace,
    createGame: createQuickMatch,
    syncAuthIdentity,
    enterScore,
    confirmScore,
    markStakeSettled,
    updateMyPayHandles,
    requestStakeExtension,
    reportStakeUnpaid,
    predict,
    commentOnMatch,
    postCourtChat,
    challengePlayer,
    createHoopLockedMatch,
    updateMatchCourt,
    submitMatchChangeProposal,
    approveMatchChangeProposal,
    sendDm,
    acceptDmRequest,
    blockPlayer,
    addFriend,
    removeFriend,
    reportPlayer,
    postMatchChat,
    inviteToMatch,
    respondGuestInvite,
  };
}

let hydrated = false;

// silence unused
void displayRating;
void namedAustinCourts;
