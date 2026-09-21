/** Presets for admin-created test accounts. No secrets. */

export const TEST_USER_PRESETS = [
  "brand_new",
  "beginner",
  "average",
  "highly_rated",
  "active_1v1",
  "court_king",
] as const;

export type TestUserPreset = (typeof TEST_USER_PRESETS)[number];

export const TEST_PRESET_LABEL: Record<TestUserPreset, string> = {
  brand_new: "Brand New User",
  beginner: "Beginner Player",
  average: "Average Player",
  highly_rated: "Highly Rated Player",
  active_1v1: "User With Active 1v1",
  court_king: "Court King",
};

export type TestUserSeed = {
  name: string;
  handle: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  neighborhood: string;
  homeCourtId?: string;
  bio: string;
  experienceYears: number;
  completeProfile: boolean;
  openGame: boolean;
};

function tag() {
  return Math.random().toString(36).slice(2, 6);
}

export function testEmailForHandle(handle: string): string {
  return `${handle.replace(/[^a-z0-9_]/gi, "").toLowerCase() || "test"}@upsetcity.test`;
}

export function isTestUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith("@upsetcity.test");
}

export function seedForPreset(preset: TestUserPreset): TestUserSeed {
  const t = tag();
  switch (preset) {
    case "brand_new":
      return {
        name: `New ${t}`,
        handle: `new_${t}`,
        rating: 1500,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        neighborhood: "East Austin",
        bio: "Just got here.",
        experienceYears: 0,
        completeProfile: false,
        openGame: false,
      };
    case "beginner":
      return {
        name: `Rookie ${t}`,
        handle: `rookie_${t}`,
        rating: 1320,
        gamesPlayed: 8,
        wins: 2,
        losses: 6,
        neighborhood: "Riverside",
        homeCourtId: "cat-butler",
        bio: "Still learning the outdoor game.",
        experienceYears: 1,
        completeProfile: true,
        openGame: false,
      };
    case "average":
      return {
        name: `Park ${t}`,
        handle: `park_${t}`,
        rating: 1500,
        gamesPlayed: 14,
        wins: 7,
        losses: 7,
        neighborhood: "Zilker",
        homeCourtId: "cat-zilker",
        bio: "Regular at the park.",
        experienceYears: 4,
        completeProfile: true,
        openGame: false,
      };
    case "highly_rated":
      return {
        name: `Heat ${t}`,
        handle: `heat_${t}`,
        rating: 1720,
        gamesPlayed: 28,
        wins: 21,
        losses: 7,
        neighborhood: "Mueller",
        homeCourtId: "cat-bartholomew",
        bio: "Come get a run.",
        experienceYears: 8,
        completeProfile: true,
        openGame: false,
      };
    case "active_1v1":
      return {
        name: `Live ${t}`,
        handle: `live_${t}`,
        rating: 1540,
        gamesPlayed: 12,
        wins: 6,
        losses: 6,
        neighborhood: "Downtown",
        homeCourtId: "cat-butler",
        bio: "Looking for a game today.",
        experienceYears: 3,
        completeProfile: true,
        openGame: true,
      };
    case "court_king":
      return {
        name: `King ${t}`,
        handle: `king_${t}`,
        rating: 1860,
        gamesPlayed: 54,
        wins: 42,
        losses: 12,
        neighborhood: "Zilker",
        homeCourtId: "cat-zilker",
        bio: "This is my court.",
        experienceYears: 12,
        completeProfile: true,
        openGame: false,
      };
  }
}
