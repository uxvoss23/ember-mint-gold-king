/**
 * Unauthorized admin-request tests.
 * Run: node --experimental-strip-types --no-warnings src/lib/auth/admin.test.ts
 */
import { ADMIN_EMAIL, assertModeratorEmail, isAdminEmail, isModeratorMe } from "./admin.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function throwsForbidden(email: string | null | undefined, label: string) {
  let threw = false;
  try {
    assertModeratorEmail(email);
  } catch (err) {
    threw = err instanceof Error && err.message === "Forbidden";
  }
  assert(threw, label);
}

function run(): string[] {
  const logs: string[] = [];
  logs.push("unauthorized admin tests");
  assert(isAdminEmail(ADMIN_EMAIL), "allowlist self");
  assert(!isAdminEmail("player@example.com"), "random email denied");
  assert(!isAdminEmail(null), "null denied");
  assert(!isAdminEmail(""), "empty denied");
  assert(!isAdminEmail(" seanvoss23@gmail.com.evil.com"), "suffix denied");
  throwsForbidden("player@example.com", "non-admin throws Forbidden");
  throwsForbidden(null, "missing email throws Forbidden");
  throwsForbidden("admin@gmail.com", "lookalike throws Forbidden");
  const ok = assertModeratorEmail(ADMIN_EMAIL.toUpperCase());
  assert(ok === ADMIN_EMAIL.toLowerCase(), "case-insensitive allow");
  assert(isModeratorMe("moderator", "player@example.com"), "db role wins");
  assert(isModeratorMe("player", ADMIN_EMAIL), "bootstrap email still admin");
  assert(!isModeratorMe("player", "player@example.com"), "regular player denied");
  logs.push("ALL UNAUTHORIZED ADMIN TESTS PASSED");
  return logs;
}

console.log(run().join("\n"));
