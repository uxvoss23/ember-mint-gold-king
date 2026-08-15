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
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 200)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3200);
await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(500);
const mm = page.getByRole("button", { name: /Match Mode/i }).first();
if (await mm.count()) await mm.click({ force: true });
await page.waitForTimeout(800);

for (let i = 0; i < 12; i++) {
  const matched = await page.evaluate(() => /It.?s a match/i.test(document.body.innerText));
  if (matched) break;
  const like = page.getByRole("button", { name: /^Like$/i }).first();
  if (!(await like.count())) break;
  await like.click({ force: true });
  await page.waitForTimeout(400);
}

const msg = page.getByRole("button", { name: /Message /i }).first();
if (await msg.count()) await msg.click({ force: true });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const t = document.body.innerText;
  const send = [...document.querySelectorAll("button")].find((b) =>
    /Send proposed plan/i.test(b.textContent || ""),
  );
  const r = send?.getBoundingClientRect();
  return {
    auto: /Auto-picked|Best court picked|best meet/i.test(t),
    change: /Change court/i.test(t),
    listOfSix: (t.match(/mi you/g) || []).length >= 4,
    tipOff: /Tip-off|When/i.test(t),
    ball: /basketball/i.test(t),
    sendVisible: Boolean(send && r && r.top > 0 && r.bottom < 844 && r.width > 100),
    sendBottom: r ? Math.round(r.bottom) : null,
    sendTop: r ? Math.round(r.top) : null,
    courtListHeading: /^Court$/m.test(t),
  };
});
await page.screenshot({ path: "/workspace/screenshots/mm-auto-propose.png" });
console.log("PROPOSE", info);

// Confirm stays visible after opening when picker (already open with guide)
const scroll = await page.evaluate(() => {
  const el = document.querySelector("[class*='overflow-y-auto']");
  if (el) el.scrollTop = el.scrollHeight;
  const send = [...document.querySelectorAll("button")].find((b) =>
    /Send proposed plan/i.test(b.textContent || ""),
  );
  const r = send?.getBoundingClientRect();
  return {
    stillVisible: Boolean(send && r && r.top > 400 && r.bottom < 850),
    bottom: r ? Math.round(r.bottom) : null,
  };
});
await page.screenshot({ path: "/workspace/screenshots/mm-auto-propose-scrolled.png" });
console.log("AFTER_SCROLL", scroll);

if (await page.getByRole("button", { name: /Change court/i }).count()) {
  await page.getByRole("button", { name: /Change court/i }).click({ force: true });
  await page.waitForTimeout(400);
}
const override = await page.evaluate(() =>
  /Other good meets|Keep this court/i.test(document.body.innerText),
);
await page.screenshot({ path: "/workspace/screenshots/mm-change-court.png" });
console.log("OVERRIDE", override);

await browser.close();
const ok =
  info.auto &&
  info.change &&
  !info.listOfSix &&
  info.tipOff &&
  info.ball &&
  info.sendVisible &&
  scroll.stillVisible &&
  override;
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
