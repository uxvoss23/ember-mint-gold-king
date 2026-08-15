import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "./types";

export type EventTier = "regular" | "major";
export type EventStatus = "upcoming" | "open" | "live" | "complete";

export interface CupEvent {
  id: string;
  name: string;
  tier: EventTier;
  /** Major number 1–4 if major */
  majorNumber?: 1 | 2 | 3 | 4;
  startsAt: string;
  /** Pool-play window end (inclusive) */
  windowEnd: string;
  /** Finals week start — top 8 lock here */
  playoffStart: string;
  location: string;
  fieldSize: number;
  status: EventStatus;
  /** Min rated games in window to qualify for top-8 consideration */
  gamesRequired: number;
  /** Anyone can register — matched by skill band */
  openToAllSkillLevels: true;
  /** Points awarded [1st, 2nd, 3rd, 4th, 5th...] */
  pointsTable: number[];
  winnerId?: string;
  /** playerId → finish place (1 = win) for completed */
  finishes?: Record<string, number>;
  blurb: string;
}

export type TournamentPhase = "registration" | "pool" | "playoffs" | "complete";

/** Pool-play line for a registered player in an event */
export interface PoolLine {
  playerId: string;
  wins: number;
  losses: number;
  /** total point differential (scored - allowed) */
  margin: number;
  gamesPlayed: number;
}

export interface EventRegistration {
  eventId: string;
  playerIds: string[];
  /** Live pool stats keyed by player */
  pool: Record<string, PoolLine>;
}

export interface CupStandingRow {
  playerId: string;
  points: number;
  wins: number;
  majorsWon: number;
  eventsPlayed: number;
  rank: number;
  prevRank: number;
}

export type MediaKind =
  | "win"
  | "upset"
  | "major"
  | "season"
  | "scheduled"
  | "streak"
  | "top10"
  | "user";

export interface MediaComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
}

export interface MediaPost {
  id: string;
  kind: MediaKind;
  headline: string;
  body: string;
  playerId: string;
  playerName: string;
  opponentId?: string;
  opponentName?: string;
  eventId?: string;
  eventName?: string;
  matchId?: string;
  /** Optional image or video URL (blob: or https) */
  mediaUrl?: string;
  mediaType?: "image" | "video";
  at: string;
  likes: string[]; // player ids
  comments: MediaComment[];
}

/** FedEx-style points: regular vs major (majors ~2×) */
const REGULAR_PTS = [500, 300, 200, 150, 100, 80, 60, 40];
const MAJOR_PTS = [1000, 600, 400, 300, 200, 160, 120, 80];

export const ATX_CUP_SEASON = {
  year: 2026,
  name: "2026 ATX Cup",
  championLabel: "ATX Cup Champion",
  endsAt: "2026-11-15T18:00:00-06:00",
};

export const ATX_EVENTS: CupEvent[] = [
  {
    id: "ev-east-opener",
    name: "East Side Opener",
    tier: "regular",
    startsAt: "2026-03-14T00:00:00-05:00",
    windowEnd: "2026-04-03T23:59:00-05:00",
    playoffStart: "2026-04-04T00:00:00-05:00",
    location: "Givens District Park · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-sean",
    finishes: {
      "p-sean": 1,
      "p-marcus": 2,
      "p-jia": 3,
      "p-kai": 4,
      "p-you": 8,
    },
    blurb: "Season kickoff. Open field, skill-matched pool play.",
  },
  {
    id: "ev-zilker-classic",
    name: "Zilker Classic",
    tier: "regular",
    startsAt: "2026-04-05T00:00:00-05:00",
    windowEnd: "2026-04-25T23:59:00-05:00",
    playoffStart: "2026-04-26T00:00:00-05:00",
    location: "Zilker Park · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-kai",
    finishes: {
      "p-kai": 1,
      "p-andre": 2,
      "p-sean": 3,
      "p-devon": 4,
      "p-you": 6,
    },
    blurb: "Central Austin regular stop.",
  },
  {
    id: "ev-major-1",
    name: "East Side Major",
    tier: "major",
    majorNumber: 1,
    startsAt: "2026-05-02T00:00:00-05:00",
    windowEnd: "2026-05-29T23:59:00-05:00",
    playoffStart: "2026-05-30T00:00:00-05:00",
    location: "Givens · citywide",
    fieldSize: 128,
    status: "complete",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    winnerId: "p-andre",
    finishes: {
      "p-andre": 1,
      "p-devon": 2,
      "p-kai": 3,
      "p-sean": 4,
      "p-marcus": 5,
      "p-you": 12,
    },
    blurb: "Major #1 — double Cup points. First jewel of the season.",
  },
  {
    id: "ev-south-run",
    name: "South Austin Run",
    tier: "regular",
    startsAt: "2026-06-07T00:00:00-05:00",
    windowEnd: "2026-06-27T23:59:00-05:00",
    playoffStart: "2026-06-28T00:00:00-05:00",
    location: "Battle Bend · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-riley",
    finishes: {
      "p-riley": 1,
      "p-you": 2,
      "p-tess": 3,
      "p-cam": 4,
    },
    blurb: "South-side regular. Open to every skill level.",
  },
  {
    id: "ev-major-2",
    name: "Zilker Major",
    tier: "major",
    majorNumber: 2,
    startsAt: "2026-07-11T00:00:00-05:00",
    windowEnd: "2026-08-07T23:59:00-05:00",
    playoffStart: "2026-08-08T00:00:00-05:00",
    location: "Zilker Park · citywide",
    fieldSize: 128,
    status: "complete",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    winnerId: "p-kai",
    finishes: {
      "p-kai": 1,
      "p-andre": 2,
      "p-sean": 3,
      "p-you": 5,
    },
    blurb: "Major #2 — midsummer showcase.",
  },
  {
    id: "ev-pease-night",
    name: "Pease Night Series",
    tier: "regular",
    startsAt: "2026-08-01T00:00:00-05:00",
    windowEnd: "2026-08-21T23:59:00-05:00",
    playoffStart: "2026-08-22T00:00:00-05:00",
    location: "Pease Park · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-jia",
    finishes: {
      "p-jia": 1,
      "p-noah": 2,
      "p-you": 3,
      "p-marcus": 4,
    },
    blurb: "Lights-on regular stop.",
  },
  {
    id: "ev-major-3",
    name: "South Austin Major",
    tier: "major",
    majorNumber: 3,
    startsAt: "2026-08-22T00:00:00-05:00",
    windowEnd: "2026-09-18T23:59:00-05:00",
    playoffStart: "2026-09-19T00:00:00-05:00",
    location: "Battle Bend · citywide",
    fieldSize: 128,
    status: "open",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    blurb: "Major #3 is live for registration. Skill-matched pool play, then top-8 knockout.",
  },
  {
    id: "ev-bartholomew",
    name: "Bartholomew Bounce",
    tier: "regular",
    startsAt: "2026-09-26T00:00:00-05:00",
    windowEnd: "2026-10-16T23:59:00-05:00",
    playoffStart: "2026-10-17T00:00:00-05:00",
    location: "Bartholomew · citywide pool",
    fieldSize: 64,
    status: "upcoming",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    blurb: "Late-season points grab.",
  },
  {
    id: "ev-major-4",
    name: "Capitol Classic",
    tier: "major",
    majorNumber: 4,
    startsAt: "2026-10-17T00:00:00-05:00",
    windowEnd: "2026-11-13T23:59:00-05:00",
    playoffStart: "2026-11-14T00:00:00-05:00",
    location: "Downtown · citywide",
    fieldSize: 128,
    status: "upcoming",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    blurb: "Major #4 — final major before the Cup chase.",
  },
  {
    id: "ev-cup-finale",
    name: "ATX Cup Finale",
    tier: "regular",
    startsAt: "2026-11-15T00:00:00-06:00",
    windowEnd: "2026-11-28T23:59:00-06:00",
    playoffStart: "2026-11-29T00:00:00-06:00",
    location: "Zilker Park · citywide",
    fieldSize: 64,
    status: "upcoming",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: [800, 500, 350, 250, 180, 120, 80, 50],
    blurb: "Season finale. Top of the Cup standings crowned champion.",
  },
];


/** Next event players can care about (open / live / soonest upcoming) */
export function getNextEvent(events: CupEvent[] = ATX_EVENTS): CupEvent | null {
  const actionable = events.filter((e) => e.status === "open" || e.status === "live");
  if (actionable.length) {
    return [...actionable].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];
  }
  const upcoming = events
    .filter((e) => e.status === "upcoming")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return upcoming[0] ?? null;
}

export function eventPhase(event: CupEvent, now = new Date()): TournamentPhase {
  if (event.status === "complete") return "complete";
  const t = now.getTime();
  const start = new Date(event.startsAt).getTime();
  const poolEnd = new Date(event.windowEnd).getTime();
  const playoff = new Date(event.playoffStart).getTime();
  if (t < start) return "registration";
  if (t <= poolEnd) return "pool";
  if (t >= playoff || event.status === "live") return "playoffs";
  return "registration";
}

export function winPct(line: PoolLine) {
  const g = line.wins + line.losses;
  return g === 0 ? 0 : line.wins / g;
}

export function avgMargin(line: PoolLine) {
  const g = line.wins + line.losses;
  return g === 0 ? 0 : line.margin / g;
}

/** Rank pool: win% desc, then avg margin of victory, then rating if provided */
export function rankPool(
  lines: PoolLine[],
  ratingById?: Map<string, number>,
): PoolLine[] {
  return [...lines].sort((a, b) => {
    const w = winPct(b) - winPct(a);
    if (Math.abs(w) > 1e-9) return w;
    const m = avgMargin(b) - avgMargin(a);
    if (Math.abs(m) > 1e-9) return m;
    const ra = ratingById?.get(a.playerId) ?? 0;
    const rb = ratingById?.get(b.playerId) ?? 0;
    return rb - ra;
  });
}

/** Top 8 seeds for finals week */
export function top8Seeds(
  lines: PoolLine[],
  gamesRequired: number,
  ratingById?: Map<string, number>,
): PoolLine[] {
  const qualified = lines.filter((l) => l.gamesPlayed >= gamesRequired);
  return rankPool(qualified, ratingById).slice(0, 8);
}

/** Skill band label from rating */
export function skillBand(rating: number): string {
  if (rating >= 1900) return "Elite (1900+)";
  if (rating >= 1700) return "Advanced (1700–1899)";
  if (rating >= 1500) return "Intermediate (1500–1699)";
  if (rating >= 1300) return "Developing (1300–1499)";
  return "Open (under 1300)";
}

export function computeStandings(events: CupEvent[] = ATX_EVENTS): CupStandingRow[] {
  const map = new Map<
    string,
    { points: number; wins: number; majorsWon: number; eventsPlayed: number }
  >();

  for (const ev of events) {
    if (!ev.finishes) continue;
    for (const [pid, place] of Object.entries(ev.finishes)) {
      const row = map.get(pid) ?? {
        points: 0,
        wins: 0,
        majorsWon: 0,
        eventsPlayed: 0,
      };
      const pts = ev.pointsTable[place - 1] ?? 0;
      row.points += pts;
      row.eventsPlayed += 1;
      if (place === 1) {
        row.wins += 1;
        if (ev.tier === "major") row.majorsWon += 1;
      }
      map.set(pid, row);
    }
  }

  const sorted = [...map.entries()]
    .map(([playerId, s]) => ({ playerId, ...s, rank: 0, prevRank: 0 }))
    .sort((a, b) => b.points - a.points || b.majorsWon - a.majorsWon || b.wins - a.wins);

  sorted.forEach((r, i) => {
    r.rank = i + 1;
    // mock previous rank: slight shuffle for movement arrows
    r.prevRank = r.rank + ((i % 3) - 1);
    if (r.prevRank < 1) r.prevRank = 1;
  });

  return sorted;
}

const SEED_MEDIA: MediaPost[] = [
  {
    id: "mp1",
    kind: "win",
    headline: "Andre Kline takes Battle Bend under the lights",
    body: "Rated 1v1 · closed out Devon 2–1 (11–7, 9–11, 11–8). Clean series, city board stays stacked.",
    playerId: "p-andre",
    playerName: "Andre Kline",
    opponentId: "p-devon",
    opponentName: "Devon Brooks",
    at: "2026-08-02T18:00:00-05:00",
    likes: ["p-sean", "p-kai", "p-jia", "p-marcus"],
    comments: [
      {
        id: "c1",
        authorId: "p-sean",
        authorName: "Sean Rivera",
        text: "Deserved. That second half was locked in.",
        at: "2026-08-02T19:00:00-05:00",
      },
    ],
  },
  {
    id: "mp2",
    kind: "upset",
    headline: "Upset: Riley Cho drops a big dog at Zilker",
    body: "Riley walks into Zilker and takes a higher-rated matchup 2–0. Pure Upset City.",
    playerId: "p-riley",
    playerName: "Riley Cho",
    opponentId: "p-marcus",
    opponentName: "Marcus Webb",
    at: "2026-08-03T21:00:00-05:00",
    likes: ["p-you", "p-cam", "p-tess"],
    comments: [],
  },
  {
    id: "mp3",
    kind: "win",
    headline: "Kai Thompson wins a war at Pease",
    body: "Kai over Andre in a physical three-game set. Two of the best in Austin going full speed.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T17:30:00-05:00",
    likes: ["p-andre", "p-sean", "p-devon", "p-noah", "p-you"],
    comments: [
      {
        id: "c2",
        authorId: "p-andre",
        authorName: "Andre Kline",
        text: "Rematch soon. Lock it in.",
        at: "2026-08-04T18:00:00-05:00",
      },
    ],
  },
  {
    id: "mp4",
    kind: "win",
    headline: "Jia Nguyen lights up Rosewood",
    body: "Night run at Rosewood. Jia takes a clean 2–0 and keeps climbing the city board.",
    playerId: "p-jia",
    playerName: "Jia Nguyen",
    at: "2026-08-04T22:00:00-05:00",
    likes: ["p-marcus", "p-you"],
    comments: [],
  },
  {
    id: "mp5",
    kind: "season",
    headline: "Weekend runs stacking up across ATX",
    body: "Open 1v1s are live citywide — Zilker, Battle Bend, Circle C. Post a game and get on the board.",
    playerId: "p-you",
    playerName: "Upset City",
    at: "2026-08-05T12:00:00-05:00",
    likes: ["p-you", "p-sean"],
    comments: [],
  },
  {
    id: "mp6",
    kind: "streak",
    headline: "Sean Rivera is on a heater — 6 in a row",
    body: "City board heat check. Sean’s win streak hits 6 straight rated 1v1s. Who slows him down?",
    playerId: "p-sean",
    playerName: "Sean Rivera",
    at: "2026-08-03T16:00:00-05:00",
    likes: ["p-you", "p-kai", "p-jia"],
    comments: [
      {
        id: "c3",
        authorId: "p-you",
        authorName: "You",
        text: "Somebody take that streak.",
        at: "2026-08-03T16:30:00-05:00",
      },
    ],
  },
  {
    id: "mp7",
    kind: "top10",
    headline: "Top 10 game of the week: Kai vs Andre",
    body: "Two of the city’s best went the full three. Final 11–9, 9–11, 11–8. Pure cinema under the lights.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T21:00:00-05:00",
    likes: ["p-andre", "p-sean", "p-you", "p-devon", "p-marcus"],
    comments: [],
  },
];

interface AtxCupState {
  /** eventId → registration payload */
  registrations: Record<string, EventRegistration>;
  posts: MediaPost[];
  register: (eventId: string, playerId: string) => void;
  isRegistered: (eventId: string, playerId: string) => boolean;
  /** Demo / log a pool game result for skill-matched play */
  logPoolGame: (
    eventId: string,
    playerId: string,
    won: boolean,
    margin: number,
  ) => void;
  toggleLike: (postId: string, playerId: string) => void;
  addComment: (
    postId: string,
    authorId: string,
    authorName: string,
    text: string,
  ) => void;
  createUserPost: (input: {
    authorId: string;
    authorName: string;
    text: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
  }) => void;
}

export const useAtxCup = create<AtxCupState>()(
  persist(
    (set, get) => ({
      registrations: {},
      posts: SEED_MEDIA,
      register: (eventId, playerId) =>
        set((s) => {
          const cur = s.registrations[eventId] ?? {
            eventId,
            playerIds: [],
            pool: {},
          };
          if (cur.playerIds.includes(playerId)) return s;
          return {
            registrations: {
              ...s.registrations,
              [eventId]: {
                ...cur,
                playerIds: [...cur.playerIds, playerId],
                pool: {
                  ...cur.pool,
                  [playerId]: cur.pool[playerId] ?? {
                    playerId,
                    wins: 0,
                    losses: 0,
                    margin: 0,
                    gamesPlayed: 0,
                  },
                },
              },
            },
          };
        }),
      isRegistered: (eventId, playerId) =>
        !!get().registrations[eventId]?.playerIds.includes(playerId),
      logPoolGame: (eventId, playerId, won, margin) =>
        set((s) => {
          const cur = s.registrations[eventId];
          if (!cur || !cur.playerIds.includes(playerId)) return s;
          const line = cur.pool[playerId] ?? {
            playerId,
            wins: 0,
            losses: 0,
            margin: 0,
            gamesPlayed: 0,
          };
          const next: PoolLine = {
            ...line,
            wins: line.wins + (won ? 1 : 0),
            losses: line.losses + (won ? 0 : 1),
            margin: line.margin + (won ? Math.abs(margin) : -Math.abs(margin)),
            gamesPlayed: line.gamesPlayed + 1,
          };
          return {
            registrations: {
              ...s.registrations,
              [eventId]: {
                ...cur,
                pool: { ...cur.pool, [playerId]: next },
              },
            },
          };
        }),
      toggleLike: (postId, playerId) =>
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const has = p.likes.includes(playerId);
            return {
              ...p,
              likes: has
                ? p.likes.filter((id) => id !== playerId)
                : [...p.likes, playerId],
            };
          }),
        })),
      addComment: (postId, authorId, authorName, text) => {
        const body = text.trim();
        if (!body) return;
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: [
                    ...p.comments,
                    {
                      id: `c-${Date.now().toString(36)}`,
                      authorId,
                      authorName,
                      text: body,
                      at: new Date().toISOString(),
                    },
                  ],
                },
          ),
        }));
      },
      createUserPost: ({ authorId, authorName, text, mediaUrl, mediaType }) => {
        const body = text.trim();
        if (!body && !mediaUrl) return;
        const headline =
          body.length > 72 ? `${body.slice(0, 69).trim()}…` : body || "Shared media";
        set((s) => ({
          posts: [
            {
              id: `mp-user-${Date.now().toString(36)}`,
              kind: "user" as const,
              headline,
              body: body || (mediaType === "video" ? "Posted a video" : "Posted a photo"),
              playerId: authorId,
              playerName: authorName,
              mediaUrl,
              mediaType,
              at: new Date().toISOString(),
              likes: [],
              comments: [],
            },
            ...s.posts,
          ],
        }));
      },
    }),
    { name: "upset-media-v1" },
  ),
);

export function majors(events: CupEvent[] = ATX_EVENTS) {
  return events.filter((e) => e.tier === "major").sort((a, b) => (a.majorNumber ?? 0) - (b.majorNumber ?? 0));
}

export function pointsForPlace(event: CupEvent, place: number) {
  return event.pointsTable[place - 1] ?? 0;
}

/** Attach display names for standings */
export function standingsWithPlayers(players: Player[]) {
  const rows = computeStandings();
  const byId = new Map(players.map((p) => [p.id, p]));
  return rows
    .map((r) => ({
      ...r,
      player: byId.get(r.playerId),
    }))
    .filter((r) => r.player);
}
