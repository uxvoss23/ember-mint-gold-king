import assert from "node:assert/strict";
import { appLog } from "./log.ts";

const lines: string[] = [];
const orig = console.info;
console.info = (...args: unknown[]) => {
  lines.push(String(args[0] ?? ""));
};

appLog("game.create", {
  gameId: "g1",
  email: "hidden@example.com",
  token: "secret-token",
  lat: 30.2672,
  lon: -97.7431,
  courtId: "cat-zilker",
});

console.info = orig;
assert.equal(lines.length, 1);
const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
assert.equal(parsed.event, "game.create");
assert.equal(parsed.gameId, "g1");
assert.equal(parsed.courtId, "cat-zilker");
assert.equal(parsed.email, undefined);
assert.equal(parsed.token, undefined);
assert.equal(parsed.lat, undefined);
assert.equal(parsed.lon, undefined);
console.log("ALL LOG SANITIZE TESTS PASSED");
