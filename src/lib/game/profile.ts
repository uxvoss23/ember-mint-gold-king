import type { Player } from "../upset/types.ts";

export const PROFILE_GENDERS = ["man", "woman", "nonbinary", "prefer_not"] as const;
export type ProfileGender = (typeof PROFILE_GENDERS)[number];

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

export type ProfileFields = {
  age: number;
  weightLb: number;
  gender: ProfileGender;
  ethnicity: string;
};

export type ProfileParse =
  | { ok: true; value: ProfileFields }
  | { ok: false; reason: string };

const ETHNICITY = new Set<string>(ETHNICITY_OPTIONS);
const GENDER = new Set<string>(PROFILE_GENDERS);

export const MIN_PLAYER_AGE = 17;
export const MAX_PLAYER_AGE = 80;

export const UNDERAGE_PLAY_MESSAGE =
  "Upset City is for players 17 and older. This account can’t post or join games.";

export function isEligibleAge(age: unknown): boolean {
  return typeof age === "number" && Number.isInteger(age) && age >= MIN_PLAYER_AGE && age <= MAX_PLAYER_AGE;
}

export function isUnderagePlayer(
  p: Pick<Player, "age">,
): boolean {
  return typeof p.age === "number" && Number.isInteger(p.age) && p.age < MIN_PLAYER_AGE;
}

export function parseProfileFields(raw: {
  age?: unknown;
  weightLb?: unknown;
  gender?: unknown;
  ethnicity?: unknown;
}): ProfileParse {
  const age = typeof raw.age === "number" ? raw.age : Number(raw.age);
  if (!Number.isInteger(age) || age < MIN_PLAYER_AGE || age > MAX_PLAYER_AGE) {
    if (Number.isInteger(age) && age < MIN_PLAYER_AGE) {
      return { ok: false, reason: UNDERAGE_PLAY_MESSAGE };
    }
    return { ok: false, reason: `Age must be ${MIN_PLAYER_AGE}–${MAX_PLAYER_AGE}.` };
  }
  const weightLb =
    typeof raw.weightLb === "number" ? raw.weightLb : Number(raw.weightLb);
  if (!Number.isInteger(weightLb) || weightLb < 80 || weightLb > 400) {
    return { ok: false, reason: "Weight must be 80–400 lb." };
  }
  const gender = typeof raw.gender === "string" ? raw.gender : "";
  if (!GENDER.has(gender)) {
    return { ok: false, reason: "Pick a gender option." };
  }
  const ethnicity = typeof raw.ethnicity === "string" ? raw.ethnicity.trim() : "";
  if (!ETHNICITY.has(ethnicity)) {
    return { ok: false, reason: "Pick an ethnicity option." };
  }
  return {
    ok: true,
    value: {
      age,
      weightLb,
      gender: gender as ProfileGender,
      ethnicity,
    },
  };
}

export function isProfileComplete(
  p: Pick<Player, "age" | "weightLb" | "gender" | "ethnicity">,
): boolean {
  return parseProfileFields({
    age: p.age,
    weightLb: p.weightLb,
    gender: p.gender,
    ethnicity: p.ethnicity,
  }).ok;
}

/** Other players: no email, auth id, moderator flag, or sensitive profile fields.
 *  Height and weight stay — catalog and profile already show them. */
export function toPublicPlayer(p: Player): Player {
  return {
    ...p,
    email: undefined,
    authUserId: undefined,
    age: undefined,
    gender: undefined,
    ethnicity: undefined,
    profileCompletedAt: undefined,
    role: undefined,
  };
}

export const PROFILE_INCOMPLETE_MESSAGE =
  "Finish your profile (age, weight, gender, ethnicity) to play. You must be 17 or older.";

/** Short in-app privacy copy. Not a legal policy. */
export const PROFILE_PRIVACY_NOTE =
  "Age, gender, and ethnicity stay on your account so we can match fairly. Other players never see them. Height and weight already show on profiles because that’s how people size up a 1v1.";
