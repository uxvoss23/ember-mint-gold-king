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
  const wideBar = /Age, rating, height, distance/i.test(t);
  const filterBtn = document.querySelector('[aria-label^="Filters"]');
  const fr = filterBtn?.getBoundingClientRect();
  const like = document.querySelector('[aria-label="Like"]');
  const pass = document.querySelector('[aria-label="Pass"]');
  const undo = document.querySelector('[aria-label="Undo"]');
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const lr = like?.getBoundingClientRect();
  const pr = pass?.getBoundingClientRect();
  const tr = tabs?.getBoundingClientRect();
  const img = document.querySelector("article img");
  const ir = img?.getBoundingClientRect();
  return {
    wideBar,
    filterIcon: Boolean(filterBtn),
    filterTop: fr ? Math.round(fr.top) : null,
    likeTop: lr ? Math.round(lr.top) : null,
    likeBottom: lr ? Math.round(lr.bottom) : null,
    passVisible: Boolean(pr && pr.top > 0 && pr.bottom < 844),
    likeVisible: Boolean(lr && lr.top > 0 && lr.bottom < 844),
    likeAboveTabs: Boolean(lr && tr && lr.bottom <= tr.top + 2),
    passAboveTabs: Boolean(pr && tr && pr.bottom <= tr.top + 2),
    tabsTop: tr ? Math.round(tr.top) : null,
    photoTop: ir ? Math.round(ir.top) : null,
    undo: Boolean(undo),
  };
});
await page.screenshot({ path: "/workspace/screenshots/mm-deck-compact.png" });
console.log(info);

await browser.close();
const ok =
  !info.wideBar &&
  info.filterIcon &&
  info.filterTop != null &&
  info.filterTop < 220 &&
  info.likeVisible &&
  info.passVisible &&
  info.likeAboveTabs &&
  info.passAboveTabs &&
  info.photoTop != null &&
  info.photoTop < 220;
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
