/**
 * Rated 1v1 series: best of 3, to 11, win by 2.
 * Run: node --experimental-strip-types --no-warnings src/lib/game/series.test.ts
 */
import { applyConfirmedResult, validateScores } from "./rules.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function ok(scores: unknown, msg: string) {
  const err = validateScores(scores);
  assert(err == null, `${msg}: unexpected ${err}`);
}

function bad(scores: unknown, msg: string) {
  const err = validateScores(scores);
  assert(err != null, `${msg}: expected rejection`);
}

function run() {
  ok(
    [
      { a: 11, b: 5 },
      { a: 11, b: 8 },
    ],
    "two-game sweep",
  );
  ok(
    [
      { a: 11, b: 9 },
      { a: 8, b: 11 },
      { a: 11, b: 7 },
    ],
    "three-game series",
  );
  ok([{ a: 11, b: 9 }, { a: 11, b: 0 }], "11–9 valid");
  bad([{ a: 11, b: 10 }, { a: 11, b: 5 }], "11–10 invalid");
  bad(
    [
      { a: 1, b: 0 },
      { a: 1, b: 0 },
    ],
    "1–0, 1–0 rejected — not played to 11",
  );
  ok(
    [
      { a: 12, b: 10 },
      { a: 11, b: 7 },
    ],
    "12–10 valid",
  );
  ok(
    [
      { a: 15, b: 13 },
      { a: 11, b: 4 },
    ],
    "15–13 valid",
  );
  bad(
    [
      { a: 15, b: 12 },
      { a: 11, b: 4 },
    ],
    "15–12 invalid",
  );
  bad(
    [
      { a: 1, b: 0 },
      { a: 11, b: 5 },
    ],
    "1–0 invalid",
  );
  bad(
    [
      { a: 11, b: 11 },
      { a: 11, b: 5 },
    ],
    "tie invalid",
  );
  bad([{ a: 11, b: 5 }], "one-game series invalid");
  bad(
    [
      { a: 11, b: 5 },
      { a: 11, b: 6 },
      { a: 11, b: 4 },
    ],
    "third game after a sweep invalid",
  );
  bad(
    [
      { a: 11, b: 5 },
      { a: 5, b: 11 },
    ],
    "split first two games without Game 3 invalid",
  );
  bad(
    [
      { a: -1, b: 11 },
      { a: 11, b: 5 },
    ],
    "negative invalid",
  );
  bad(
    [
      { a: 11.5, b: 7 },
      { a: 11, b: 5 },
    ],
    "decimal invalid",
  );
  bad([{ a: 11 }, { a: 11, b: 5 }], "missing score invalid");
  bad("nope", "malformed invalid");
  bad(
    [
      { a: 99, b: 97 },
      { a: 11, b: 5 },
    ],
    "excessively large invalid",
  );

  const stats = {
    rating: 1500,
    gamesPlayed: 10,
    wins: 5,
    losses: 5,
    streak: 1,
    pointsScored: 100,
    pointsAllowed: 90,
    weeklyWins: 1,
    weeklyLosses: 1,
  };
  let threw = false;
  try {
    applyConfirmedResult({
      host: { ...stats },
      opp: { ...stats },
      scores: [{ a: 11, b: 10 }, { a: 11, b: 5 }],
    });
  } catch {
    threw = true;
  }
  assert(threw, "confirming an invalid stored score cannot change ratings");

  console.log("ALL SERIES TESTS PASSED");
}

run();
