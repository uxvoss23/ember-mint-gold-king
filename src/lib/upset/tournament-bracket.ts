import type { Player } from "./types";

export type GameMode = "1v1" | "2v2" | "3v3" | "5v5" | "horse";

export type BracketMatchStatus = "upcoming" | "live" | "final" | "bye";

export interface BracketSlot {
  playerId: string | null;
  name: string;
  seed: number | null;
  score?: number;
  isWinner?: boolean;
  isYou?: boolean;
}

export interface BracketMatch {
  id: string;
  round: number; // 0 = first round
  index: number; // position in round
  status: BracketMatchStatus;
  top: BracketSlot;
  bottom: BracketSlot;
  court?: string;
  tipOff?: string;
}

export interface TournamentBracket {
  tournamentId: string;
  name: string;
  mode: GameMode;
  size: number; // power of 2
  rounds: BracketMatch[][];
  championId: string | null;
  championName: string | null;
}

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Classic 1–N seed pairing for a round of size. */
function seedOrder(size: number): number[] {
  // returns seed numbers 1..size in bracket positions
  let arr = [1, 2];
  while (arr.length < size) {
    const next: number = arr.length * 2 + 1;
    const out: number[] = [];
    for (const s of arr) {
      out.push(s);
      out.push(next - s);
    }
    arr = out;
  }
  return arr;
}

const ROUND_NAMES: Record<number, string> = {};

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  const slots = 2 ** (totalRounds - round);
  return `Round of ${slots}`;
}

/**
 * Build a single-elim bracket from Austin players.
 * size forced to power of 2 (8 or 16 typically).
 * Progresses early rounds with mock scores for demo.
 */
export function buildBracket(opts: {
  tournamentId: string;
  name: string;
  mode: GameMode;
  players: Player[];
  meId: string;
  size?: number;
  /** 0 = nothing played, higher = more rounds complete */
  progressRounds?: number;
}): TournamentBracket {
  const size = nextPow2(opts.size ?? 8);
  const totalRounds = Math.log2(size);
  const ranked = [...opts.players]
    .filter((p) => p.city === "Austin")
    .sort((a, b) => b.rating - a.rating);

  // ensure "you" is in the field
  const me = opts.players.find((p) => p.id === opts.meId);
  let field = ranked.slice(0, size);
  if (me && !field.some((p) => p.id === me.id)) {
    field = [...field.slice(0, size - 1), me];
  }
  // pad with TBD bye placeholders if short
  while (field.length < size) {
    field.push({
      id: `bye-${field.length}`,
      name: "BYE",
      handle: "bye",
      city: "Austin",
      heightIn: 0,
      weightLb: 0,
      experienceYears: 0,
      rating: 0,
      gamesPlayed: 0,
      sportsmanship: 0,
      reliability: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      availability: "offline",
      hue: 0,
      quietStart: 0,
      quietEnd: 0,
      pingsToday: 0,
      pingsDate: "",
      ignoreStreak: 0,
      preferredHour: 0,
      openToChallenges: false,
      dmPrivacy: "nobody",
      hideFromCatalog: true,
      challengesToday: 0,
      challengesDate: "",
      dmFirstToday: 0,
      dmFirstDate: "",
      rankLastWeek: 99,
      pointsScored: 0,
      pointsAllowed: 0,
      weeklyWins: 0,
      weeklyLosses: 0,
      ratingLastWeek: 0,
    } as Player);
  }

  // map seed number -> player (seed 1 = highest rating)
  const bySeed = new Map<number, Player>();
  field.forEach((p, i) => bySeed.set(i + 1, p));

  const order = seedOrder(size);
  const progress = opts.progressRounds ?? Math.min(2, totalRounds - 1);

  const rounds: BracketMatch[][] = [];

  // Round 0 from seeds
  const r0: BracketMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    const seedTop = order[i * 2];
    const seedBot = order[i * 2 + 1];
    const topP = bySeed.get(seedTop)!;
    const botP = bySeed.get(seedBot)!;
    const topBye = topP.id.startsWith("bye");
    const botBye = botP.id.startsWith("bye");
    let status: BracketMatchStatus = progress > 0 ? "final" : "upcoming";
    if (topBye || botBye) status = "bye";

    const topScore =
      status === "final" || status === "bye"
        ? botBye
          ? 11
          : topBye
            ? 0
            : 11 + (i % 3)
        : undefined;
    const botScore =
      status === "final" || status === "bye"
        ? topBye
          ? 11
          : botBye
            ? 0
            : 7 + (i % 4)
        : undefined;

    let topWin = false;
    let botWin = false;
    if (status === "final" || status === "bye") {
      if (topBye) botWin = true;
      else if (botBye) topWin = true;
      else if ((topScore ?? 0) >= (botScore ?? 0)) topWin = true;
      else botWin = true;
    }

    r0.push({
      id: `${opts.tournamentId}-r0-m${i}`,
      round: 0,
      index: i,
      status: status === "final" && i === 0 && progress === 0 ? "live" : status,
      top: {
        playerId: topBye ? null : topP.id,
        name: topBye ? "BYE" : topP.name,
        seed: seedTop,
        score: topScore,
        isWinner: topWin,
        isYou: topP.id === opts.meId,
      },
      bottom: {
        playerId: botBye ? null : botP.id,
        name: botBye ? "BYE" : botP.name,
        seed: seedBot,
        score: botScore,
        isWinner: botWin,
        isYou: botP.id === opts.meId,
      },
      court: i % 2 === 0 ? "Court A" : "Court B",
      tipOff: progress > 0 ? undefined : `Game ${i + 1}`,
    });
  }
  // first match live if no progress
  if (progress === 0 && r0[0]) {
    r0[0].status = "live";
    r0[0].top.score = 6;
    r0[0].bottom.score = 4;
  }
  rounds.push(r0);

  // Subsequent rounds
  for (let r = 1; r < totalRounds; r++) {
    const prev = rounds[r - 1];
    const matches: BracketMatch[] = [];
    const done = r < progress;
    const liveRound = r === progress;

    for (let i = 0; i < prev.length / 2; i++) {
      const m1 = prev[i * 2];
      const m2 = prev[i * 2 + 1];
      const w1 = winnerSlot(m1);
      const w2 = winnerSlot(m2);

      let status: BracketMatchStatus = "upcoming";
      if (done) status = "final";
      else if (liveRound && i === 0 && w1.name !== "TBD" && w2.name !== "TBD")
        status = "live";

      const topScore = status === "final" ? 11 + (i % 2) : status === "live" ? 3 : undefined;
      const botScore = status === "final" ? 8 + (i % 3) : status === "live" ? 2 : undefined;
      let topWin = false;
      let botWin = false;
      if (status === "final") {
        if ((topScore ?? 0) >= (botScore ?? 0)) topWin = true;
        else botWin = true;
      }

      matches.push({
        id: `${opts.tournamentId}-r${r}-m${i}`,
        round: r,
        index: i,
        status,
        top: {
          ...w1,
          score: topScore,
          isWinner: topWin,
        },
        bottom: {
          ...w2,
          score: botScore,
          isWinner: botWin,
        },
        court: "Main",
        tipOff: status === "upcoming" ? "TBD" : undefined,
      });
    }
    rounds.push(matches);
  }

  const last = rounds[rounds.length - 1][0];
  const champ =
    last?.status === "final"
      ? last.top.isWinner
        ? last.top
        : last.bottom.isWinner
          ? last.bottom
          : null
      : null;

  void ROUND_NAMES;

  return {
    tournamentId: opts.tournamentId,
    name: opts.name,
    mode: opts.mode,
    size,
    rounds,
    championId: champ?.playerId ?? null,
    championName: champ?.name ?? null,
  };
}

function winnerSlot(m: BracketMatch): BracketSlot {
  if (m.status === "final" || m.status === "bye") {
    if (m.top.isWinner)
      return {
        playerId: m.top.playerId,
        name: m.top.name,
        seed: m.top.seed,
        isYou: m.top.isYou,
      };
    if (m.bottom.isWinner)
      return {
        playerId: m.bottom.playerId,
        name: m.bottom.name,
        seed: m.bottom.seed,
        isYou: m.bottom.isYou,
      };
  }
  // if only one side known
  if (m.top.playerId && !m.bottom.playerId)
    return {
      playerId: m.top.playerId,
      name: m.top.name,
      seed: m.top.seed,
      isYou: m.top.isYou,
    };
  if (m.bottom.playerId && !m.top.playerId)
    return {
      playerId: m.bottom.playerId,
      name: m.bottom.name,
      seed: m.bottom.seed,
      isYou: m.bottom.isYou,
    };
  return { playerId: null, name: "TBD", seed: null };
}
