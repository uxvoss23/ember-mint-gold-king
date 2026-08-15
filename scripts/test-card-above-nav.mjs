#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function check(height, name) {
  const page = await browser.newPage({
    viewport: { width: 390, height },
    isMobile: true,
    hasTouch: true,
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
  await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
  await page.waitForTimeout(350);
  const mm = page.getByRole("button", { name: /Match Mode/i }).first();
  if (await mm.count()) await mm.click({ force: true });
  await page.waitForTimeout(900);

  const info = await page.evaluate((vh) => {
    const like = document.querySelector('[aria-label="Like"]');
    const pass = document.querySelector('[aria-label="Pass"]');
    const undo = document.querySelector('[aria-label="Undo"]');
    const zap = document.querySelector('[aria-label="Challenge"]');
    const nameEl = document.querySelector("article .font-display");
    const rating = /RATING/i.test(document.body.innerText);
    const card = document.querySelector("article");
    const tabs = document.getElementById("uc-bottom-tab-bar");
    const cr = card?.getBoundingClientRect();
    const tr = tabs?.getBoundingClientRect();
    const lr = like?.getBoundingClientRect();
    const pr = pass?.getBoundingClientRect();
    const gap = cr && tr ? tr.top - cr.bottom : null;
    return {
      vh,
      cardBottom: cr ? Math.round(cr.bottom) : null,
      tabsTop: tr ? Math.round(tr.top) : null,
      gap: gap != null ? Math.round(gap) : null,
      likeBottom: lr ? Math.round(lr.bottom) : null,
      likeAboveTabs: Boolean(lr && tr && lr.bottom <= tr.top - 8),
      passAboveTabs: Boolean(pr && tr && pr.bottom <= tr.top - 8),
      cardAboveTabs: Boolean(cr && tr && cr.bottom <= tr.top - 10),
      nameVisible: Boolean(nameEl && nameEl.getBoundingClientRect().bottom < (tr?.top ?? vh)),
      rating,
      undo: Boolean(undo),
      zap: Boolean(zap),
      likeVisible: Boolean(lr && lr.height > 20 && lr.bottom < vh),
    };
  }, height);
  await page.screenshot({
    path: `/workspace/screenshots/mm-card-nav-${name}.png`,
  });
  await page.close();
  return info;
}

const se = await check(667, "se");
const std = await check(844, "iphone");
const pro = await check(932, "pro");
console.log({ se, std, pro });

await browser.close();
const ok = [se, std, pro].every(
  (r) =>
    r.cardAboveTabs &&
    r.likeAboveTabs &&
    r.passAboveTabs &&
    r.likeVisible &&
    r.nameVisible &&
    r.rating &&
    r.gap != null &&
    r.gap >= 12 &&
    r.gap <= 24,
);
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
