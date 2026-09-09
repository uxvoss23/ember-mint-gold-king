import { RATE_LIMITS, RateLimitError } from "./rate-limit.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(RATE_LIMITS.createGame.max >= 1, "create game has a limit");
assert(RATE_LIMITS.dm.windowSec > 0, "dm window");
const err = new RateLimitError(12);
assert(err.status === 429, "429");
assert(err.retryAfterSec === 12, "retry-after");
assert(/try again/i.test(err.message), "user-facing message");

console.log("ALL RATE LIMIT TESTS PASSED");
