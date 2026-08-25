import type { ChatMessage, Match, MatchGame, MatchStatus, Player } from "@/lib/upset/types";
import { STARTING_RATING } from "@/lib/config";

export type PlayerRow = {
  id: string;
  user_id: string | null;
  name: string;
  handle: string;
  city: string;
  height_in: number;
  weight_lb: number;
  experience_years: number;
  rating: number;
  games_played: number;
  sportsmanship: number;
  reliability: number;
  wins: number;
  losses: number;
  streak: number;
  home_court_id: string | null;
  availability: Player["availability"];
  bio: string | null;
  hue: number;
  photo_url: string | null;
  neighborhood: string | null;
  age: number | null;
  gender: Player["gender"] | null;
  ethnicity: string | null;
  open_to_challenges: boolean;
  hide_from_catalog: boolean;
  dm_privacy: Player["dmPrivacy"];
  points_scored: number;
  points_allowed: number;
  weekly_wins: number;
  weekly_losses: number;
  rating_last_week: number;
  rank_last_week: number;
  preferred_hour: number | null;
};

export type GameRow = {
  id: string;
  kind: Match["kind"];
  format: Match["format"];
  host_id: string;
  opponent_id: string | null;
  court_id: string;
  court_name: string;
  lat: number;
  lon: number;
  preferred_at: string;
  scheduled_at: string | null;
  accepted_at: string | null;
  status: MatchStatus;
  notes: string | null;
  host_bringing_ball: boolean | null;
  opponent_bringing_ball: boolean | null;
  invite_only: boolean;
  allow_guest_invites: boolean;
  scores_json: string | null;
  score_entered_by: string | null;
  score_confirmed_by: string | null;
  rating_delta_host: number | null;
  rating_delta_opp: number | null;
  from_hoop_match_id: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  game_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  system: boolean;
  created_at: string;
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "t" || v === "true") return true;
  if (v === "f" || v === "false") return false;
  return fallback;
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

export function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    city: row.city || "Austin",
    heightIn: num(row.height_in, 72),
    weightLb: num(row.weight_lb, 180),
    experienceYears: num(row.experience_years, 0),
    rating: num(row.rating, STARTING_RATING),
    gamesPlayed: num(row.games_played, 0),
    sportsmanship: num(row.sportsmanship, 5),
    reliability: num(row.reliability, 5),
    wins: num(row.wins, 0),
    losses: num(row.losses, 0),
    streak: num(row.streak, 0),
    homeCourtId: row.home_court_id ?? undefined,
    availability: row.availability || "available",
    bio: row.bio ?? undefined,
    hue: num(row.hue, 24),
    photoUrl: row.photo_url ?? undefined,
    quietStart: 22,
    quietEnd: 7,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: num(row.preferred_hour, 19),
    openToChallenges: bool(row.open_to_challenges, true),
    dmPrivacy: row.dm_privacy || "everyone",
    hideFromCatalog: bool(row.hide_from_catalog, false),
    neighborhood: row.neighborhood ?? undefined,
    age: row.age ?? undefined,
    gender: row.gender ?? undefined,
    ethnicity: row.ethnicity ?? undefined,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: num(row.rank_last_week, 0),
    pointsScored: num(row.points_scored, 0),
    pointsAllowed: num(row.points_allowed, 0),
    weeklyWins: num(row.weekly_wins, 0),
    weeklyLosses: num(row.weekly_losses, 0),
    ratingLastWeek: num(row.rating_last_week, STARTING_RATING),
    authUserId: row.user_id ?? undefined,
  };
}

export function parseScores(json: string | null): MatchGame[] | undefined {
  if (!json) return undefined;
  try {
    const v = JSON.parse(json) as MatchGame[];
    if (!Array.isArray(v)) return undefined;
    return v
      .filter((g) => g && Number.isFinite(g.a) && Number.isFinite(g.b))
      .map((g) => ({ a: Number(g.a), b: Number(g.b) }));
  } catch {
    return undefined;
  }
}

export function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    authorId: row.author_id ?? undefined,
    authorName: row.author_name,
    text: row.body,
    at: iso(row.created_at),
    system: bool(row.system, false),
  };
}

export function rowToMatch(
  row: GameRow,
  extras?: { invites?: string[]; chat?: ChatMessage[] },
): Match {
  return {
    id: row.id,
    kind: row.kind || "broadcast",
    format: row.format || "1v1",
    hostId: row.host_id,
    opponentId: row.opponent_id ?? undefined,
    courtId: row.court_id,
    courtName: row.court_name,
    lat: num(row.lat),
    lon: num(row.lon),
    preferredAt: iso(row.preferred_at),
    scheduledAt: row.scheduled_at ? iso(row.scheduled_at) : undefined,
    acceptedAt: row.accepted_at ? iso(row.accepted_at) : undefined,
    status: row.status,
    notes: row.notes ?? undefined,
    hostBringingBall: row.host_bringing_ball ?? undefined,
    opponentBringingBall: row.opponent_bringing_ball ?? undefined,
    inviteOnly: bool(row.invite_only, false),
    allowGuestInvites: bool(row.allow_guest_invites, false),
    guestInviteIds: extras?.invites ?? [],
    rosterIds: [row.host_id, row.opponent_id].filter((x): x is string => !!x),
    filters: {
      heightMinIn: 60,
      heightMaxIn: 90,
      ratingMin: 800,
      ratingMax: 2500,
      sportsmanshipMin: 3,
      radiusMiles: 50,
    },
    scores: parseScores(row.scores_json),
    scoreEnteredBy: row.score_entered_by ?? undefined,
    scoreConfirmedBy: row.score_confirmed_by ?? undefined,
    confirmedBy: row.score_confirmed_by ?? undefined,
    ratingDeltaHost: row.rating_delta_host ?? undefined,
    ratingDeltaOpp: row.rating_delta_opp ?? undefined,
    fromHoopMatchId: row.from_hoop_match_id ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    cancelledAt: row.cancelled_at ? iso(row.cancelled_at) : undefined,
    predictions: {},
    comments: [],
    chat: extras?.chat ?? [],
    createdAt: iso(row.created_at),
  };
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

export function handleFromName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 16);
  return base || "player";
}
