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
await page.waitForTimeout(2800);
await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(400);
const mm = page.getByRole("button", { name: /Match Mode/i }).first();
if (await mm.count()) await mm.click({ force: true });
await page.waitForTimeout(900);

const info = await page.evaluate(() => {
  const t = document.body.innerText;
  const undo = document.querySelector('[aria-label="Undo"]');
  const pass = document.querySelector('[aria-label="Pass"]');
  const like = document.querySelector('[aria-label="Like"]');
  const zap = document.querySelector('[aria-label="Challenge"]');
  const img = document.querySelector("article img");
  const ir = img?.getBoundingClientRect();
  return {
    rating: /RATING/i.test(t),
    record: /W-L RECORD/i.test(t),
    rank: /RANK/i.test(t),
    loc: /LOCATION/i.test(t),
    hint: /Swipe right to like/i.test(t),
    undo: Boolean(undo),
    pass: Boolean(pass),
    like: Boolean(like),
    zap: Boolean(zap),
    photoH: ir ? Math.round(ir.height) : 0,
    photoW: ir ? Math.round(ir.width) : 0,
    nameish: /[A-Z][a-z]+ [A-Z]/.test(t),
    noOldBioChips: !/Record\n/i.test(t.split("W-L")[0] ?? ""),
  };
});
await page.screenshot({ path: "/workspace/screenshots/mm-card-design.png" });
console.log(info);

// swipe still works
const like = page.getByRole("button", { name: /^Like$/i }).first();
if (await like.count()) {
  await like.click({ force: true });
  await page.waitForTimeout(400);
}
const afterLike = await page.evaluate(() =>
  /It.?s a match|Swipe right to like/i.test(document.body.innerText),
);
console.log("AFTER_LIKE", afterLike);

await browser.close();
const ok =
  info.rating &&
  info.record &&
  info.rank &&
  info.loc &&
  info.hint &&
  info.undo &&
  info.pass &&
  info.like &&
  info.zap &&
  info.photoH > 220 &&
  afterLike;
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
