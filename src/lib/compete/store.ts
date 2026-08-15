import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AUSTIN_PLAYERS } from "./seed";
import type { CompeteState, GameChallenge, Player } from "./types";

const STORAGE_KEY = "court-compete-v1";

function defaultState(): CompeteState {
  return {
    players: AUSTIN_PLAYERS,
    games: [],
    meId: "p-you",
  };
}

function load(): CompeteState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as CompeteState;
    // Ensure seed players exist; merge by id
    const byId = new Map(parsed.players.map((p) => [p.id, p]));
    for (const p of AUSTIN_PLAYERS) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return {
      meId: parsed.meId || "p-you",
      players: Array.from(byId.values()),
      games: Array.isArray(parsed.games) ? parsed.games : [],
    };
  } catch {
    return defaultState();
  }
}

let state: CompeteState = defaultState();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function setState(next: CompeteState | ((prev: CompeteState) => CompeteState)) {
  state = typeof next === "function" ? next(state) : next;
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return defaultState();
}

export function useCompeteStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // hydrate from localStorage once on client
  useEffect(() => {
    const loaded = load();
    state = loaded;
    emit();
  }, []);

  const me = snap.players.find((p) => p.id === snap.meId) ?? snap.players[0]!;

  const leaderboard = [...snap.players]
    .filter((p) => p.city === "Austin")
    .sort((a, b) => b.rating - a.rating);

  const openGames = snap.games
    .filter((g) => g.status === "open")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const createGame = useCallback(
    (input: Omit<GameChallenge, "id" | "createdAt" | "status" | "hostPlayerId">) => {
      const game: GameChallenge = {
        ...input,
        id: `g-${Date.now().toString(36)}`,
        hostPlayerId: state.meId,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, games: [game, ...s.games] }));
      return game;
    },
    [],
  );

  const joinGame = useCallback((gameId: string) => {
    setState((s) => ({
      ...s,
      games: s.games.map((g) =>
        g.id === gameId && g.status === "open" && g.hostPlayerId !== s.meId
          ? { ...g, status: "matched", challengerId: s.meId }
          : g,
      ),
    }));
  }, []);

  const cancelGame = useCallback((gameId: string) => {
    setState((s) => ({
      ...s,
      games: s.games.map((g) =>
        g.id === gameId && g.hostPlayerId === s.meId
          ? { ...g, status: "cancelled" }
          : g,
      ),
    }));
  }, []);

  const updateMe = useCallback((patch: Partial<Player>) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === s.meId ? { ...p, ...patch } : p)),
    }));
  }, []);

  return {
    me,
    players: snap.players,
    games: snap.games,
    openGames,
    leaderboard,
    createGame,
    joinGame,
    cancelGame,
    updateMe,
  };
}

export function playerMatchesFilters(
  player: Player,
  filters: GameChallenge["filters"],
): boolean {
  return (
    player.heightIn >= filters.heightMinIn &&
    player.heightIn <= filters.heightMaxIn &&
    player.rating >= filters.ratingMin &&
    player.rating <= filters.ratingMax &&
    player.sportsmanship >= filters.sportsmanshipMin
  );
}
