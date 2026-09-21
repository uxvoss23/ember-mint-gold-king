/**
 * Run: node --experimental-strip-types --no-warnings src/lib/auth/mail-outbox.test.ts
 */
import assert from "node:assert/strict";
import { peekAuthMail, rememberAuthMail } from "./mail-outbox.ts";

rememberAuthMail("You@Email.com", "reset", "https://example.com/reset-password?token=abc");
assert.equal(peekAuthMail("you@email.com", "reset"), "https://example.com/reset-password?token=abc");
assert.equal(peekAuthMail("you@email.com", "verify"), null);
rememberAuthMail("you@email.com", "alert", "https://example.com/game");
assert.equal(peekAuthMail("you@email.com", "alert"), null);
console.log("ALL MAIL OUTBOX TESTS PASSED");
