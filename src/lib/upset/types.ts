export type Availability = "available" | "busy" | "offline";
export type MatchStatus =
  | "open"
  | "matched"
  | "scheduled"
  | "played_pending"
  | "confirmed"
  | "disputed"
  | "cancelled"
  | "no_show";

export type DmPrivacy = "everyone" | "played" | "nobody";

/** 1v1 live; team formats reserved for coming-soon UI */
export type MatchFormat = "1v1" | "horse" | "3v3" | "5v5";
export type MatchKind = "broadcast" | "challenge" | "invite";

export interface Player {
  id: string;
  name: string;
  handle: string;
  city: string;
  heightIn: number;
  weightLb: number;
  experienceYears: number;
  rating: number;
  gamesPlayed: number;
  sportsmanship: number;
  reliability: number;
  wins: number;
  losses: number;
  streak: number;
  homeCourtId?: string;
  availability: Availability;
  bio?: string;
  hue: number;
  /** High-quality face photo URL (public path) */
  photoUrl?: string;
  quietStart: number;
  quietEnd: number;
  pingsToday: number;
  pingsDate: string;
  ignoreStreak: number;
  lastPlayedAt?: string;
  preferredHour: number;
  openToChallenges: boolean;
  challengeRatingMin?: number;
  challengeRatingMax?: number;
  dmPrivacy: DmPrivacy;
  hideFromCatalog: boolean;
  neighborhood?: string;
  age?: number;
  /** Self-reported for matching filters */
  gender?: "man" | "woman" | "nonbinary" | "prefer_not";
  /** Broad category for browse filters */
  ethnicity?: string;
  challengesToday: number;
  challengesDate: string;
  dmFirstToday: number;
  dmFirstDate: string;
  rankLastWeek: number;
  pointsScored: number;
  pointsAllowed: number;
  weeklyWins: number;
  weeklyLosses: number;
  ratingLastWeek: number;
  /** Peer settle handles (never shown on court map) */
  payCashApp?: string;
  payVenmo?: string;
  payZelle?: string;
  /** Linked Better Auth user id when signed in */
  authUserId?: string;
  email?: string;
  /** Permanent ban from league (e.g. unpaid stakes) */
  exiled?: boolean;
  exiledAt?: string;
  exiledReason?: string;
}

export interface CourtMeta {
  courtId: string;
  kingId?: string;
  kingLastPlayedAt?: string;
  chat: ChatMessage[];
  crownTtlDays: number;
}

export type MatchChangeProposalStatus = "pending" | "approved" | "superseded";

export interface MatchChangeProposal {
  courtId: string;
  courtName: string;
  lat: number;
  lon: number;
  whenIso: string;
  whenLabel: string;
  proposedById: string;
  proposedByName: string;
  status: MatchChangeProposalStatus;
}

export interface ChatMessage {
  id: string;
  authorId?: string;
  authorName: string;
  text: string;
  at: string;
  system?: boolean;
  /** Match Mode / scheduled change cards */
  kind?: "text" | "proposal" | "proposal_update";
  proposal?: MatchChangeProposal;
}

export interface MatchGame {
  a: number;
  b: number;
}

/** How the match is “playing for something” */
export type StakeMode = "fun" | "stakes" | "charity";

/**
 * Playing-for model:
 * - fun: rating only
 * - charity: fixed gift ($5–$20) to Alzheimer's after dual-confirm
 * - stakes: removed from product (legacy type only)
 */
export interface MatchStakes {
  mode: StakeMode;
  /**
   * Charity (margin model): $ per point of total series margin.
   * Stakes (fixed price): unused for payout — see fixedPriceDollars.
   */
  dollarsPerPoint: number;
  /**
   * Stakes only — the named price. Loser pays winner this amount.
   * Also shown on open listings so people know what’s on the line.
   */
  fixedPriceDollars?: number;
  /** Optional ceiling (charity margin model) */
  capDollars?: number;
  charityName?: string;
  charityUrl?: string;
  /** Filled after series is scored + confirmed */
  totalMarginPoints?: number;
  amountDollars?: number;
  loserId?: string;
  winnerId?: string;
  /** Loser marked donation/paid complete */
  settled?: boolean;
  settledAt?: string;
  settleMethod?: "cashapp" | "venmo" | "zelle" | "cash" | "charity" | "other";
  /**
   * Settlement health after scores lock.
   * unpaid report → exile. extension = working with them.
   */
  paymentStatus?:
    | "pending"
    | "extension_requested"
    | "reported_unpaid"
    | "exiled"
    | "settled";
  payDeadlineAt?: string;
  extensionNote?: string;
  extensionRequestedAt?: string;
  reportedUnpaidAt?: string;
  reportedById?: string;
}

export interface MatchFilters {
  heightMinIn: number;
  heightMaxIn: number;
  ratingMin: number;
  ratingMax: number;
  sportsmanshipMin: number;
  radiusMiles: number;
}

export interface MatchComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
}

/** Peer review of a player’s game (from people who’ve run with them). */
export interface PlayerReview {
  id: string;
  targetId: string;
  authorId: string;
  authorName: string;
  /** 1–5 stars for how their game feels */
  stars: number;
  text: string;
  at: string;
}

export interface Match {
  id: string;
  kind: MatchKind;
  format?: MatchFormat;
  hostId: string;
  opponentId?: string;
  courtId: string;
  courtName: string;
  lat: number;
  lon: number;
  preferredAt: string;
  scheduledAt?: string;
  acceptedAt?: string;
  status: MatchStatus;
  /** Host notes: size, skill, vibe they’re looking for */
  notes?: string;
  /** Host: bringing a basketball? */
  hostBringingBall?: boolean;
  /** Opponent: bringing a basketball? */
  opponentBringingBall?: boolean;
  /** Set once when both said no — avoid duplicate alerts */
  ballNeitherAlerted?: boolean;
  /** Playing for fun / stakes / charity */
  stakes?: MatchStakes;
  allowGuestInvites?: boolean;
  /** If true, only players in guestInviteIds can join — not listed as open public */
  inviteOnly?: boolean;
  rosterIds?: string[];
  guestInviteIds?: string[];
  filters: MatchFilters;
  scores?: MatchGame[];
  scoreEnteredBy?: string;
  /** Second party who dual-confirmed the score (required for rating lock) */
  scoreConfirmedBy?: string;
  confirmedBy?: string;
  ratingDeltaHost?: number;
  ratingDeltaOpp?: number;
  predictions: Record<string, string>;
  comments: MatchComment[];
  chat: ChatMessage[];
  createdAt: string;
  /** Set when this scheduled game was created from Match Mode */
  fromHoopMatchId?: string;
  /** Cancellation metadata so host/opponent can see why */
  cancelledBy?: string;
  cancelReason?: string;
  cancelledAt?: string;
  /** True if cancelled within 24h of tip-off */
  cancelWasLate?: boolean;
}

export interface DirectThread {
  id: string;
  participantIds: string[];
  isRequest: boolean;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface Report {
  id: string;
  targetId: string;
  reason: string;
  at: string;
}

/** Track cancellations for monthly sportsmanship rules */
export interface CancelLogEntry {
  id: string;
  playerId: string;
  matchId: string;
  at: string;
  late: boolean;
  reason: string;
  sportsmanshipHit: number;
  /**
   * host_empty — host pulled listing before anyone joined (never penalized)
   * host_after_join — host cancelled after opponent locked in
   * player — non-host cancelled
   */
  kind: "host_empty" | "host_after_join" | "player";
}

export interface UpsetState {
  players: Player[];
  matches: Match[];
  courtMeta: Record<string, CourtMeta>;
  meId: string;
  leagueChat: ChatMessage[];
  dmThreads: DirectThread[];
  blockedIds: string[];
  friendIds: string[];
  reports: Report[];
  playerReviews: PlayerReview[];
  cancelLog: CancelLogEntry[];
  crownTtlDays: number;
  seedVersion: number;
}
