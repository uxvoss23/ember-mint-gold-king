/**
 * Run: node --experimental-strip-types --no-warnings src/lib/auth/mail.test.ts
 */
import assert from "node:assert/strict";
import { appMailUrl, mailConfigured, mailFrom, sendAppEmail } from "./mail.ts";

assert.equal(mailConfigured({}), false);
assert.equal(mailConfigured({ RESEND_API_KEY: "   " }), false);
assert.equal(mailConfigured({ RESEND_API_KEY: "re_test" }), true);
assert.equal(mailFrom({}), "Upset City <noreply@upsetcity.app>");
assert.equal(mailFrom({ MAIL_FROM: "Upset City <hi@example.com>" }), "Upset City <hi@example.com>");

const reset = appMailUrl(
  "https://play.upsetcity.app/reset-password/abc?callbackURL=%2Freset-password",
  "tok_1",
  "reset",
);
assert.equal(reset, "https://play.upsetcity.app/reset-password?token=tok_1");

const verify = appMailUrl(
  "https://play.upsetcity.app/verify-email?token=raw",
  "tok_2",
  "verify",
);
assert.ok(verify.startsWith("https://play.upsetcity.app/api/auth/verify-email?token=tok_2"));
assert.ok(verify.includes("callbackURL="));

const calls: Array<{ url: string; init: RequestInit }> = [];
const skipped = await sendAppEmail({
  to: "hidden@example.com",
  kind: "reset",
  url: "https://example.com/reset-password?token=secret",
  env: {},
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response("ok", { status: 200 });
  },
});
assert.equal(skipped.sent, false);
assert.equal(calls.length, 0);

const sent = await sendAppEmail({
  to: "hidden@example.com",
  kind: "reset",
  url: "https://example.com/reset-password?token=secret",
  env: { RESEND_API_KEY: "re_test", MAIL_FROM: "Upset City <hi@example.com>" },
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response("{}", { status: 200 });
  },
});
assert.equal(sent.sent, true);
assert.equal(calls.length, 1);
assert.equal(calls[0]?.url, "https://api.resend.com/emails");
const body = JSON.parse(String(calls[0]?.init.body)) as {
  from: string;
  to: string[];
  subject: string;
};
assert.equal(body.from, "Upset City <hi@example.com>");
assert.deepEqual(body.to, ["hidden@example.com"]);
assert.equal(body.subject, "Reset your Upset City password");

const skippedTest = await sendAppEmail({
  to: "live_ab12@upsetcity.test",
  kind: "reset",
  url: "https://example.com/reset-password?token=secret",
  env: { RESEND_API_KEY: "re_test" },
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response("{}", { status: 200 });
  },
});
assert.equal(skippedTest.sent, false);
assert.equal(calls.length, 1);

console.log("ALL MAIL TESTS PASSED");
