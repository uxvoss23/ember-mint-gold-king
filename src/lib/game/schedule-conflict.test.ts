import assert from "node:assert/strict";
import {
  collectBusySlots,
  conflictMessage,
  holdsOverlap,
  slotConflict,
  type ScheduleGame,
} from "./schedule-conflict.ts";

const t7 = Date.parse("2026-09-24T14:00:00.000Z"); // 7am-ish depending TZ; just a timestamp
const t830 = t7 + 90 * 60 * 1000;
const t9 = t7 + 120 * 60 * 1000;

assert.equal(holdsOverlap(t7, t7), true);
assert.equal(holdsOverlap(t7, t7 + 30 * 60 * 1000), true);
assert.equal(holdsOverlap(t7, t830), false, "back-to-back 90 min is allowed");
assert.equal(holdsOverlap(t7, t9), false);

const games: ScheduleGame[] = [
  {
    id: "g1",
    hostId: "me",
    opponentId: null,
    courtId: "cat-butler",
    status: "open",
    preferredAt: new Date(t7).toISOString(),
  },
  {
    id: "g2",
    hostId: "other",
    opponentId: "x",
    courtId: "cat-zilker",
    status: "scheduled",
    preferredAt: new Date(t9).toISOString(),
    scheduledAt: new Date(t9).toISOString(),
  },
];

const mine = collectBusySlots(games, { playerId: "me", courtId: "cat-zilker" });
assert.equal(mine.filter((b) => b.reason === "yours").length, 1);
assert.equal(mine.filter((b) => b.reason === "court").length, 1);
assert.ok(slotConflict(t7, mine));
assert.equal(slotConflict(t7 + 3 * 3600_000, mine)?.reason, "court");
assert.equal(slotConflict(t7, mine, 90 * 60 * 1000)?.reason, "yours");
assert.equal(conflictMessage("yours"), "You already have a game at that time.");

const ignoreSelf = collectBusySlots(games, {
  playerId: "me",
  courtId: "cat-butler",
  ignoreGameId: "g1",
});
assert.equal(ignoreSelf.length, 0);

const cancelled: ScheduleGame[] = [
  { ...games[0]!, status: "cancelled" },
];
assert.equal(collectBusySlots(cancelled, { playerId: "me" }).length, 0);

console.log("schedule-conflict tests passed");
