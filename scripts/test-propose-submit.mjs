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
await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(400);
const mm = page.getByRole("button", { name: /Match Mode/i }).first();
if (await mm.count()) await mm.click({ force: true });
await page.waitForTimeout(700);

for (let i = 0; i < 12; i++) {
  const matched = await page.evaluate(() => /It.?s a match/i.test(document.body.innerText));
  if (matched) break;
  const like = page.getByRole("button", { name: /^Like$/i }).first();
  if (!(await like.count())) {
    const reshuffle = page.getByRole("button", { name: /Reshuffle/i }).first();
    if (await reshuffle.count()) await reshuffle.click({ force: true });
    else break;
    await page.waitForTimeout(300);
    continue;
  }
  await like.click({ force: true });
  await page.waitForTimeout(350);
}

const msg = page.getByRole("button", { name: /Message /i }).first();
if (await msg.count()) await msg.click({ force: true });
await page.waitForTimeout(700);

// Open change court to recreate the crowded screenshot
const change = page.getByRole("button", { name: /Change court/i }).first();
if (await change.count()) await change.click({ force: true });
await page.waitForTimeout(400);

const metrics = async (label) => {
  const m = await page.evaluate(() => {
    const send = [...document.querySelectorAll("button")].find((b) =>
      /Send proposed plan/i.test(b.textContent || ""),
    );
    const ball = [...document.querySelectorAll("label")].find((el) =>
      /bring a basketball/i.test(el.textContent || ""),
    );
    const tabs = document.getElementById("uc-bottom-tab-bar");
    const sr = send?.getBoundingClientRect();
    const br = ball?.getBoundingClientRect();
    const tr = tabs?.getBoundingClientRect();
    return {
      sendVisible: Boolean(sr && sr.width > 80 && sr.top >= 0 && sr.bottom <= 844 && sr.bottom > 500),
      sendTop: sr ? Math.round(sr.top) : null,
      sendBottom: sr ? Math.round(sr.bottom) : null,
      tabsTop: tr ? Math.round(tr.top) : null,
      sendAboveTabs: Boolean(sr && tr && sr.bottom <= tr.top + 2),
      ballText: Boolean(ball),
      ballTop: br ? Math.round(br.top) : null,
      ballBottom: br ? Math.round(br.bottom) : null,
    };
  });
  console.log(label, m);
  return m;
};

const before = await metrics("OPEN_OVERRIDE");
await page.screenshot({ path: "/workspace/screenshots/mm-submit-override.png" });

// Scroll the propose scroller to the bottom
await page.evaluate(() => {
  const els = [...document.querySelectorAll("div")].filter((el) => {
    const s = getComputedStyle(el);
    return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20;
  });
  const scroller = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
});
await page.waitForTimeout(300);

const after = await metrics("SCROLLED");
await page.screenshot({ path: "/workspace/screenshots/mm-submit-scrolled.png" });

const ballClear = after.ballBottom != null && after.sendTop != null && after.ballBottom <= after.sendTop + 8;
const ok =
  before.sendVisible &&
  before.sendAboveTabs &&
  after.sendVisible &&
  after.sendAboveTabs &&
  after.ballText &&
  ballClear;

await browser.close();
if (!ok) {
  console.error("FAIL", { ballClear });
  process.exit(1);
}
console.log("PASS");
