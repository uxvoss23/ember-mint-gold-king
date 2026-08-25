/**
 * Phase 2 self-test: rating floor, join/score rules, confirmation, ranking.
 * Run: node --experimental-strip-types --no-warnings src/lib/game/game.test.ts
 */
import { RATING_FLOOR, rateSeries } from "../rating/engine.ts";
import {
  applyConfirmedResult,
  canConfirmScore,
  canDisputeScore,
  canEnterScore,
  canJoinGame,
  compareLadder,
  validateScores,
} from "./rules.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run(): string[] {
  const logs: string[] = [];
  logs.push("phase 2 rule tests");

  const open = canJoinGame({
    status: "open",
    hostId: "h",
    inviteOnly: false,
    inviteeIds: [],
    actorId: "o",
  });
  assert(open.ok, "open joinable");
  const self = canJoinGame({
    status: "open",
    hostId: "h",
    inviteOnly: false,
    inviteeIds: [],
    actorId: "h",
  });
  assert(!self.ok && self.reason === "self", "host cannot join own game");
  const filled = canJoinGame({
    status: "scheduled",
    hostId: "h",
    opponentId: "o",
    inviteOnly: false,
    inviteeIds: [],
    actorId: "x",
  });
  assert(!filled.ok, "scheduled not joinable");
  const invite = canJoinGame({
    status: "open",
    hostId: "h",
    inviteOnly: true,
    inviteeIds: ["o"],
    actorId: "x",
  });
  assert(!invite.ok && invite.reason === "invite_only", "invite-only gate");
  const invited = canJoinGame({
    status: "open",
    hostId: "h",
    inviteOnly: true,
    inviteeIds: ["o"],
    actorId: "o",
  });
  assert(invited.ok, "invitee can join");
  const dup = canJoinGame({
    status: "scheduled",
    hostId: "h",
    opponentId: "o",
    inviteOnly: false,
    inviteeIds: [],
    actorId: "o",
  });
  assert(dup.ok, "idempotent re-join of existing opponent");
  logs.push("join rules ok");

  const outsider = canEnterScore({
    status: "scheduled",
    hostId: "h",
    opponentId: "o",
    actorId: "x",
  });
  assert(!outsider.ok, "outsider cannot submit");
  const hostEnter = canEnterScore({
    status: "scheduled",
    hostId: "h",
    opponentId: "o",
    actorId: "h",
  });
  assert(hostEnter.ok, "host can submit");
  const selfConfirm = canConfirmScore({
    status: "played_pending",
    hostId: "h",
    opponentId: "o",
    scoreEnteredBy: "h",
    actorId: "h",
  });
  assert(!selfConfirm.ok, "submitter cannot confirm");
  const oppConfirm = canConfirmScore({
    status: "played_pending",
    hostId: "h",
    opponentId: "o",
    scoreEnteredBy: "h",
    actorId: "o",
  });
  assert(oppConfirm.ok, "opponent can confirm");
  const disputeOk = canDisputeScore({
    status: "played_pending",
    hostId: "h",
    opponentId: "o",
    scoreEnteredBy: "h",
    actorId: "o",
  });
  assert(disputeOk.ok, "opponent can dispute");
  logs.push("score auth ok");

  assert(validateScores([{ a: 11, b: 11 }]) != null, "ties rejected");
  assert(validateScores([{ a: 11, b: 7 }, { a: 11, b: 8 }]) == null, "valid series");

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
  const applied = applyConfirmedResult({
    host: { ...stats },
    opp: { ...stats, rating: 1400 },
    scores: [
      { a: 11, b: 5 },
      { a: 11, b: 6 },
    ],
  });
  assert(applied.hostWon, "host won series");
  assert(applied.host.wins === 6 && applied.opp.losses === 6, "record updates once");
  assert(applied.host.gamesPlayed === 11 && applied.opp.gamesPlayed === 11, "games played +1");
  assert(applied.host.rating >= stats.rating, "winner never loses rating");
  logs.push(`confirm apply host Δ ${applied.result.aDelta.toFixed(2)}`);

  const floorHit = rateSeries(
    { rating: 101, gamesPlayed: 80 },
    { rating: 1800, gamesPlayed: 80 },
    [
      { a: 0, b: 11 },
      { a: 1, b: 11 },
    ],
  );
  assert(floorHit.aNew >= RATING_FLOOR, "rating floor held");
  logs.push("rating floor ok");

  const ranked = [
    { id: "b", rating: 1600, gamesPlayed: 2, wins: 2 },
    { id: "a", rating: 1600, gamesPlayed: 4, wins: 3 },
    { id: "c", rating: 1700, gamesPlayed: 1, wins: 1 },
  ].sort(compareLadder);
  assert(ranked[0]!.id === "c", "highest rating first");
  assert(ranked[1]!.id === "a", "tie-break games played");
  logs.push("ladder order ok");

  logs.push("ALL PHASE 2 RULE TESTS PASSED");
  return logs;
}

const out = run();
for (const line of out) console.log(line);
