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
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(400);
const mm = page.getByRole("button", { name: /Match Mode/i }).first();
if (await mm.count()) await mm.click({ force: true });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const article = document.querySelector("article");
  const pass = document.querySelector('button[aria-label="Pass"]');
  const like = document.querySelector('button[aria-label="Like"]');
  const ar = article?.getBoundingClientRect();
  const pr = pass?.getBoundingClientRect();
  const lr = like?.getBoundingClientRect();
  const inside =
    ar && pr && pr.top >= ar.top - 4 && pr.bottom <= ar.bottom + 8;
  return {
    name: /Andre Kline/.test(document.body.innerText),
    articleBottom: ar ? Math.round(ar.bottom) : null,
    articleH: ar ? Math.round(ar.height) : 0,
    passInsideCard: !!inside,
    likeInsideCard: !!(ar && lr && lr.bottom <= ar.bottom + 8 && lr.top >= ar.top - 4),
    passVisible: !!(pr && pr.bottom < 800 && pr.top > 0),
    compactOld: /Challenge instead/.test(document.body.innerText),
    tabTop: document.getElementById("uc-bottom-tab-bar")?.getBoundingClientRect().top,
  };
});

await page.screenshot({ path: "/workspace/screenshots/mm-on-card-btns.png" });
console.log(JSON.stringify(info, null, 2));
await browser.close();
if (!info.passInsideCard || !info.likeInsideCard || info.compactOld || !info.passVisible) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
