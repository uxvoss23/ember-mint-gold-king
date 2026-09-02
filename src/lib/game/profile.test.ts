/**
 * Phase 7: profile validation + public payload stripping.
 * Run: node --experimental-strip-types --no-warnings src/lib/game/profile.test.ts
 */
import {
  isProfileComplete,
  parseProfileFields,
  toPublicPlayer,
  PROFILE_PRIVACY_NOTE,
} from "./profile.ts";
import type { Player } from "../upset/types.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function player(over: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Pat",
    handle: "pat",
    city: "Austin",
    heightIn: 72,
    weightLb: 180,
    experienceYears: 4,
    rating: 1500,
    gamesPlayed: 0,
    sportsmanship: 5,
    reliability: 5,
    wins: 0,
    losses: 0,
    streak: 0,
    availability: "available",
    hue: 24,
    quietStart: 22,
    quietEnd: 7,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 19,
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 0,
    pointsScored: 0,
    pointsAllowed: 0,
    weeklyWins: 0,
    weeklyLosses: 0,
    ratingLastWeek: 1500,
    email: "pat@example.com",
    authUserId: "user-1",
    ...over,
  };
}

function run(): string[] {
  const logs: string[] = [];
  logs.push("phase 7 profile tests");

  const badAge = parseProfileFields({
    age: 12,
    weightLb: 180,
    gender: "man",
    ethnicity: "White",
  });
  assert(!badAge.ok, "age 12 rejected");
  const badWeight = parseProfileFields({
    age: 24,
    weightLb: 40,
    gender: "man",
    ethnicity: "White",
  });
  assert(!badWeight.ok, "weight 40 rejected");
  const badGender = parseProfileFields({
    age: 24,
    weightLb: 180,
    gender: "alien",
    ethnicity: "White",
  });
  assert(!badGender.ok, "unknown gender rejected");
  const ok = parseProfileFields({
    age: 24,
    weightLb: 180,
    gender: "man",
    ethnicity: "White",
  });
  assert(ok.ok, "valid profile accepted");
  logs.push("validation ok");

  assert(!isProfileComplete(player()), "defaults are not complete");
  assert(
    isProfileComplete(
      player({ age: 22, weightLb: 175, gender: "woman", ethnicity: "Black" }),
    ),
    "four fields complete",
  );
  logs.push("completeness ok");

  const pub = toPublicPlayer(
    player({
      age: 22,
      gender: "man",
      ethnicity: "Latino",
      email: "secret@x.com",
      authUserId: "u-secret",
      role: "moderator",
    }),
  );
  assert(pub.age === undefined, "public omits age");
  assert(pub.gender === undefined, "public omits gender");
  assert(pub.ethnicity === undefined, "public omits ethnicity");
  assert(pub.email === undefined, "public omits email");
  assert(pub.authUserId === undefined, "public omits auth id");
  assert(pub.role === undefined, "public omits moderator role");
  assert(pub.weightLb === 180, "public keeps displayed weight");
  assert(pub.heightIn === 72, "public keeps displayed height");
  logs.push("public strip ok");

  assert(
    PROFILE_PRIVACY_NOTE.toLowerCase().includes("never see"),
    "privacy note says others never see those fields",
  );
  logs.push("privacy copy ok");

  return logs;
}

const logs = run();
console.log(logs.join("\n"));
console.log("ALL PROFILE TESTS PASSED");
