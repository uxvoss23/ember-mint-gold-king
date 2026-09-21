/**
 * Run: node --experimental-strip-types --no-warnings src/lib/admin/test-users.test.ts
 */
import assert from "node:assert/strict";
import {
  isTestUserEmail,
  seedForPreset,
  testEmailForHandle,
  TEST_USER_PRESETS,
} from "./test-users.ts";

assert.equal(isTestUserEmail("live_ab12@upsetcity.test"), true);
assert.equal(isTestUserEmail("sean@gmail.com"), false);
assert.equal(testEmailForHandle("Rookie_1"), "rookie_1@upsetcity.test");

for (const preset of TEST_USER_PRESETS) {
  const seed = seedForPreset(preset);
  assert.ok(seed.name.length > 1, preset);
  assert.ok(seed.handle.length > 1, preset);
  assert.ok(seed.rating >= 1200 && seed.rating <= 2000, preset);
}
assert.equal(seedForPreset("brand_new").completeProfile, false);
assert.equal(seedForPreset("active_1v1").openGame, true);
assert.equal(seedForPreset("court_king").homeCourtId, "cat-zilker");
assert.ok(seedForPreset("court_king").rating > seedForPreset("beginner").rating);

console.log("ALL TEST USER PRESET TESTS PASSED");
