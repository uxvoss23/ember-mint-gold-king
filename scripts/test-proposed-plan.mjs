#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 180)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3200);
await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(500);
const mm = page.getByRole("button", { name: /Match Mode/i }).first();
if (await mm.count()) await mm.click({ force: true });
await page.waitForTimeout(800);

// Like through deck until it's a match (demo reciprocal likes)
for (let i = 0; i < 12; i++) {
  const matched = await page.evaluate(() =>
    /It.?s a match/i.test(document.body.innerText),
  );
  if (matched) break;
  const like = page.getByRole("button", { name: /^Like$/i }).first();
  if (!(await like.count())) break;
  await like.click({ force: true });
  await page.waitForTimeout(450);
}

const afterLikes = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log("AFTER_LIKES", JSON.stringify(afterLikes.slice(0, 220)));

const msg = page.getByRole("button", { name: /Message /i }).first();
if (await msg.count()) await msg.click({ force: true });
await page.waitForTimeout(700);

const propose = await page.evaluate(() => {
  const t = document.body.innerText;
  return {
    proposeTitle: /Propose time & place/.test(t),
    sendPlan: /Send proposed plan/.test(t),
    lockScheduled: /Lock run · Scheduled/.test(t),
    courtList: /Battle Bend|Rosewood|Pease|Hancock|Givens|Zilker/.test(t),
    when: /When/.test(t),
    ball: /basketball/i.test(t),
  };
});
await page.screenshot({ path: "/workspace/screenshots/mm-propose.png" });
console.log("PROPOSE", propose);

const send = page.getByRole("button", { name: /Send proposed plan/i }).first();
if (await send.count()) await send.click({ force: true });
await page.waitForTimeout(700);

const plan = await page.evaluate(() => {
  const t = document.body.innerText;
  return {
    proposed: /Proposed plan/i.test(t),
    waiting: /Waiting for/.test(t),
    editPlace: /Edit time & place/.test(t),
    demoApprove: /Approve as .*demo/i.test(t),
    newPlan: /Edit or send a new plan/.test(t),
    youAre: /You are bringing a basketball/.test(t),
    youIs: /You is bringing/.test(t),
    messageBox: /Message /.test(t),
  };
});
await page.screenshot({ path: "/workspace/screenshots/mm-proposed-plan.png" });
console.log("PLAN", plan);

const demo = page.getByRole("button", { name: /Approve as /i }).first();
if (await demo.count()) await demo.click({ force: true });
await page.waitForTimeout(600);
const approved = await page.evaluate(() => {
  const t = document.body.innerText;
  return {
    approved: /Approved plan|On Scheduled/.test(t),
    scheduled: /Scheduled/.test(t),
  };
});
await page.screenshot({ path: "/workspace/screenshots/mm-plan-approved.png" });
console.log("APPROVED", approved);

await browser.close();

const ok =
  propose.proposeTitle &&
  propose.sendPlan &&
  !propose.lockScheduled &&
  plan.proposed &&
  plan.waiting &&
  plan.editPlace &&
  plan.demoApprove &&
  plan.newPlan &&
  !plan.youIs &&
  approved.scheduled;
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
