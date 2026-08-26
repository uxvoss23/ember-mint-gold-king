/**
 * Phase 1: safe returnTo + popup detection.
 * Run: node --experimental-strip-types --no-warnings src/lib/auth/return-to.test.ts
 */
import {
  isLivePreviewHost,
  safeReturnTo,
} from "./return-to.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run(): string[] {
  const logs: string[] = [];
  logs.push("phase 1 returnTo tests");

  assert(safeReturnTo("/login") === "/login", "relative path");
  assert(safeReturnTo("/?create=1") === "/?create=1", "query ok");
  assert(safeReturnTo("/") === "/", "root");
  assert(safeReturnTo("//evil.com") === "/", "protocol-relative");
  assert(safeReturnTo("https://evil.com") === "/", "absolute https");
  assert(safeReturnTo("http://evil.com") === "/", "absolute http");
  assert(safeReturnTo("javascript:alert(1)") === "/", "javascript");
  assert(safeReturnTo("/\\evil") === "/", "backslash");
  assert(safeReturnTo("login") === "/", "missing slash");
  assert(safeReturnTo("") === "/", "empty");
  assert(safeReturnTo(null) === "/", "null");
  assert(safeReturnTo("/foo\nbar") === "/", "newline");
  assert(safeReturnTo("/a".repeat(401)) === "/", "too long");
  assert(safeReturnTo("/login#x") === "/login#x", "hash ok");
  logs.push("safeReturnTo ok");

  assert(isLivePreviewHost("abc.grok-sandbox.com") === true, "preview host");
  assert(isLivePreviewHost("upsetcity.app") === false, "prod host");
  logs.push("host checks ok");

  logs.push("ALL PHASE 1 RETURN-TO TESTS PASSED");
  return logs;
}

console.log(run().join("\n"));
