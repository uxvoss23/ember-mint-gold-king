export type Availability =
  | "available"
  | "busy"
  | "offline";

export interface Player {
  id: string;
  name: string;
  handle: string;
  city: string;
  /** Height in total inches (e.g. 74 = 6'2") */
  heightIn: number;
  /** Competitive rating (Elo-style), typically 800–2400 */
  rating: number;
  /** 1.0–5.0 sportsmanship stars */
  sportsmanship: number;
  wins: number;
  losses: number;
  /** 0–100 form / recent form */
  form: number;
  availability: Availability;
  /** Short bio */
  bio?: string;
  /** Avatar color seed */
  hue: number;
}

export interface GameChallenge {
  id: string;
  hostPlayerId: string;
  courtId: string;
  courtName: string;
  lat: number;
  lon: number;
  /** ISO datetime */
  startsAt: string;
  notes?: string;
  /** Match filters set by host */
  filters: {
    heightMinIn: number;
    heightMaxIn: number;
    ratingMin: number;
    ratingMax: number;
    sportsmanshipMin: number;
  };
  status: "open" | "matched" | "completed" | "cancelled";
  challengerId?: string;
  createdAt: string;
}

export interface CompeteState {
  players: Player[];
  games: GameChallenge[];
  /** Local “you” profile id */
  meId: string;
}
