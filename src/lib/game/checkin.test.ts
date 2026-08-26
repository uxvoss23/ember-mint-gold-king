/**
 * Phase 6 check-in / no-show / reliability.
 * Run: node --experimental-strip-types --no-warnings src/lib/game/checkin.test.ts
 */
import {
  canCheckIn,
  canReportNoShow,
  checkInWindow,
  reliabilityFromEvents,
} from "./checkin.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run(): string[] {
  const logs: string[] = [];
  logs.push("phase 6 check-in tests");
  const tip = 1_000_000;
  assert(checkInWindow(tip, tip - 46 * 60 * 1000).canCheckIn === false, "too early");
  assert(checkInWindow(tip, tip - 10 * 60 * 1000).canCheckIn === true, "45-min window");
  assert(checkInWindow(tip, tip + 10 * 60 * 1000).canCheckIn === true, "after tip still open");
  assert(checkInWindow(tip, tip + 31 * 60 * 1000).canCheckIn === false, "closed after 30");
  assert(checkInWindow(tip, tip + 31 * 60 * 1000).canReportNoShow === true, "no-show after grace");
  assert(checkInWindow(tip, tip).canReportNoShow === false, "not at tip");

  const outsider = canCheckIn({
    hostId: "h",
    opponentId: "o",
    actorId: "x",
    status: "scheduled",
    tipMs: tip,
    nowMs: tip,
  });
  assert(!outsider.ok, "outsider cannot check in");

  const ok = canCheckIn({
    hostId: "h",
    opponentId: "o",
    actorId: "h",
    status: "scheduled",
    tipMs: tip,
    nowMs: tip,
  });
  assert(ok.ok, "host can check in");

  const noshowEarly = canReportNoShow({
    hostId: "h",
    opponentId: "o",
    actorId: "h",
    actorCheckedIn: true,
    status: "scheduled",
    tipMs: tip,
    nowMs: tip,
  });
  assert(!noshowEarly.ok, "no-show too early");

  const noshowNoCheck = canReportNoShow({
    hostId: "h",
    opponentId: "o",
    actorId: "h",
    actorCheckedIn: false,
    status: "scheduled",
    tipMs: tip,
    nowMs: tip + 40 * 60 * 1000,
  });
  assert(!noshowNoCheck.ok, "must check in first");

  const noshowOk = canReportNoShow({
    hostId: "h",
    opponentId: "o",
    actorId: "h",
    actorCheckedIn: true,
    status: "scheduled",
    tipMs: tip,
    nowMs: tip + 40 * 60 * 1000,
  });
  assert(noshowOk.ok, "checked-in host can report after grace");

  const rated = canReportNoShow({
    hostId: "h",
    opponentId: "o",
    actorId: "h",
    actorCheckedIn: true,
    status: "confirmed",
    tipMs: tip,
    nowMs: tip + 40 * 60 * 1000,
  });
  assert(!rated.ok, "confirmed game cannot become a rated no-show");

  const fresh = reliabilityFromEvents([]);
  assert(fresh.score === 5, "new player starts at 5");
  const hit = reliabilityFromEvents([{ kind: "verified_noshow" }]);
  assert(hit.score < 5, "verified no-show drops reliability");
  const recover = reliabilityFromEvents([
    { kind: "verified_noshow" },
    ...Array.from({ length: 12 }, () => ({ kind: "confirmed_game" as const })),
  ]);
  assert(recover.score > hit.score, "rolling history recovers");
  logs.push("ALL PHASE 6 CHECK-IN TESTS PASSED");
  return logs;
}

console.log(run().join("\n"));
