import {
  compareMatchCloseness,
  matchClosenessRing,
  matchClosenessScore,
} from "./match-closeness.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const me = { id: "me", rating: 1500, heightIn: 72 };

const twin = { id: "twin", rating: 1500, heightIn: 72 };
const nearSkill = { id: "near", rating: 1520, heightIn: 73 };
const tall = { id: "tall", rating: 1500, heightIn: 80 };
const farSkill = { id: "far", rating: 1700, heightIn: 72 };

assert(
  matchClosenessScore(me, twin) < matchClosenessScore(me, nearSkill),
  "identical player is closest",
);
assert(
  matchClosenessScore(me, nearSkill) < matchClosenessScore(me, tall),
  "small rating+height gap beats 8 inches",
);
assert(
  matchClosenessScore(me, nearSkill) < matchClosenessScore(me, farSkill),
  "near skill beats +200 rating",
);
assert(matchClosenessRing(matchClosenessScore(me, twin)) === 0, "twin is ring 0");
assert(matchClosenessRing(matchClosenessScore(me, farSkill)) >= 2, "far skill is a stretch");

const ordered = [farSkill, tall, twin, nearSkill].sort((a, b) =>
  compareMatchCloseness(me, a, b),
);
assert(
  ordered.map((p) => p.id).join(",") === "twin,near,tall,far",
  `expected twin,near,tall,far got ${ordered.map((p) => p.id)}`,
);

const inbound = new Set(["far"]);
assert(
  compareMatchCloseness(me, nearSkill, farSkill, { inboundIds: inbound }) < 0,
  "inbound far still loses to a close matchup",
);
assert(
  compareMatchCloseness(me, twin, { ...twin, id: "twin2" }, { inboundIds: inbound }) ===
    compareMatchCloseness(me, twin, { ...twin, id: "twin2" }),
  "inbound does not reorder equal closeness against a non-inbound twin",
);

const closerInbound = compareMatchCloseness(
  me,
  { id: "a", rating: 1510, heightIn: 72 },
  { id: "b", rating: 1510, heightIn: 72 },
  { inboundIds: new Set(["b"]) },
);
assert(closerInbound > 0, "same skill: the person who already liked you goes first");

console.log("ALL MATCH CLOSENESS TESTS PASSED");
