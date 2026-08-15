/**
 * Lightweight runtime checks for the rating engine (no test runner required).
 * Run: npx tsx src/lib/rating/engine.test.ts  OR import and call runRatingSelfTest()
 */
import {
  expectedWinProbability,
  handicapLine,
  kFactor,
  rateSeries,
  RATING_CONSTANTS,
} from "./engine";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runRatingSelfTest(): string[] {
  const logs: string[] = [];
  const log = (s: string) => logs.push(s);

  // K decays with games played
  assert(kFactor(0) === RATING_CONSTANTS.k0, "k at 0 games");
  assert(kFactor(RATING_CONSTANTS.halfLife) < RATING_CONSTANTS.k0, "k decays");
  assert(kFactor(1000) > RATING_CONSTANTS.kMin - 0.01, "k floors near k_min");
  log("k-factor ok");

  // Equal ratings → ~50% win
  const p = expectedWinProbability(1500, 1500);
  assert(Math.abs(p - 0.5) < 1e-9, "equal winprob");
  log("equal winprob ok");

  // Big favorite wins cleanly → gains
  const clean = rateSeries(
    { rating: 1800, gamesPlayed: 30 },
    { rating: 1400, gamesPlayed: 30 },
    [
      { a: 11, b: 4 },
      { a: 11, b: 5 },
    ],
  );
  assert(clean.aDelta > 0, "favorite clean win gains");
  assert(clean.bDelta < 0, "underdog blowout loses");
  log(`clean favorite +${clean.aDelta.toFixed(2)}`);

  // Win but ugly (favorite barely scrapes) — win never costs
  const ugly = rateSeries(
    { rating: 1800, gamesPlayed: 40 },
    { rating: 1400, gamesPlayed: 40 },
    [
      { a: 11, b: 10 },
      { a: 10, b: 12 },
      { a: 12, b: 10 },
    ],
  );
  assert(ugly.aDelta >= 0, "win never costs rating");
  log(`ugly win delta ${ugly.aDelta.toFixed(2)}`);

  // Underdog loses close → may gain
  const closeLoss = rateSeries(
    { rating: 1400, gamesPlayed: 15 },
    { rating: 1800, gamesPlayed: 40 },
    [
      { a: 11, b: 13 },
      { a: 10, b: 12 },
    ],
  );
  assert(closeLoss.aDelta > 0, "close underdog loss gains");
  log(`close underdog loss +${closeLoss.aDelta.toFixed(2)}`);

  const line = handicapLine(1400, 1800);
  assert(!line.isFavorite, "underdog flag");
  assert(line.display.includes("Score"), "handicap copy");
  log(line.display);

  log("ALL RATING TESTS PASSED");
  return logs;
}

// Allow direct execution
if (typeof process !== "undefined" && process.argv[1]?.includes("engine.test")) {
  for (const line of runRatingSelfTest()) console.log(line);
}
