import type { Player } from "@/lib/upset/types";

export type GenderFilter = "man" | "woman" | "nonbinary" | "prefer_not";

export interface BrowseFilters {
  /** empty = any */
  ageMin: number | null;
  ageMax: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
  heightMinIn: number | null;
  heightMaxIn: number | null;
  /** empty = any */
  genders: GenderFilter[];
  /** empty = any; values match player.ethnicity */
  ethnicities: string[];
  /** max distance in miles; null = any */
  milesMax: number | null;
}

export const DEFAULT_BROWSE_FILTERS: BrowseFilters = {
  ageMin: null,
  ageMax: null,
  ratingMin: null,
  ratingMax: null,
  heightMinIn: null,
  heightMaxIn: null,
  genders: [],
  ethnicities: [],
  milesMax: null,
};

export const ETHNICITY_OPTIONS = [
  "Asian",
  "Black",
  "Latino",
  "Middle Eastern",
  "Native",
  "Pacific Islander",
  "South Asian",
  "White",
  "Mixed",
  "Other",
] as const;

export const GENDER_OPTIONS: { id: GenderFilter; label: string }[] = [
  { id: "man", label: "Men" },
  { id: "woman", label: "Women" },
  { id: "nonbinary", label: "Nonbinary" },
  { id: "prefer_not", label: "Prefer not" },
];

export function browseFilterActiveCount(f: BrowseFilters): number {
  let n = 0;
  if (f.ageMin != null || f.ageMax != null) n++;
  if (f.ratingMin != null || f.ratingMax != null) n++;
  if (f.heightMinIn != null || f.heightMaxIn != null) n++;
  if (f.genders.length) n++;
  if (f.ethnicities.length) n++;
  if (f.milesMax != null) n++;
  return n;
}

export function playerMatchesBrowseFilters(
  player: Player,
  f: BrowseFilters,
  miles?: number | null,
): boolean {
  if (f.ageMin != null || f.ageMax != null) {
    const age = player.age;
    if (age == null) return false;
    if (f.ageMin != null && age < f.ageMin) return false;
    if (f.ageMax != null && age > f.ageMax) return false;
  }
  if (f.ratingMin != null && player.rating < f.ratingMin) return false;
  if (f.ratingMax != null && player.rating > f.ratingMax) return false;
  if (f.heightMinIn != null && player.heightIn < f.heightMinIn) return false;
  if (f.heightMaxIn != null && player.heightIn > f.heightMaxIn) return false;
  if (f.genders.length) {
    if (!player.gender || !f.genders.includes(player.gender)) return false;
  }
  if (f.ethnicities.length) {
    if (!player.ethnicity || !f.ethnicities.includes(player.ethnicity))
      return false;
  }
  if (f.milesMax != null) {
    if (miles == null || miles > f.milesMax) return false;
  }
  return true;
}


const BROWSE_FILTERS_KEY = "uc-browse-filters-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

export type StoredBrowseFilters = {
  filters: BrowseFilters;
  /** When true, filters persist across sessions until user resets */
  saved: boolean;
  updatedAt: number;
};

function isBrowseFilters(v: unknown): v is BrowseFilters {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    "ageMin" in o &&
    "ratingMin" in o &&
    "heightMinIn" in o &&
    "genders" in o &&
    "ethnicities" in o &&
    "milesMax" in o
  );
}

/** Load filters — unsaved expire after 24h; saved keep until reset */
export function loadBrowseFilters(): {
  filters: BrowseFilters;
  saved: boolean;
} {
  if (typeof window === "undefined") {
    return { filters: { ...DEFAULT_BROWSE_FILTERS }, saved: false };
  }
  try {
    const raw = localStorage.getItem(BROWSE_FILTERS_KEY);
    if (!raw) return { filters: { ...DEFAULT_BROWSE_FILTERS }, saved: false };
    const data = JSON.parse(raw) as Partial<StoredBrowseFilters>;
    if (!isBrowseFilters(data.filters)) {
      return { filters: { ...DEFAULT_BROWSE_FILTERS }, saved: false };
    }
    const saved = !!data.saved;
    const updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : 0;
    if (!saved && updatedAt > 0 && Date.now() - updatedAt > DAY_MS) {
      localStorage.removeItem(BROWSE_FILTERS_KEY);
      return { filters: { ...DEFAULT_BROWSE_FILTERS }, saved: false };
    }
    return { filters: data.filters, saved };
  } catch {
    return { filters: { ...DEFAULT_BROWSE_FILTERS }, saved: false };
  }
}

export function persistBrowseFilters(
  filters: BrowseFilters,
  saved: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredBrowseFilters = {
      filters,
      saved,
      updatedAt: Date.now(),
    };
    localStorage.setItem(BROWSE_FILTERS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedBrowseFilters(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BROWSE_FILTERS_KEY);
  } catch {
    /* ignore */
  }
}
