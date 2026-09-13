#!/usr/bin/env node
/**
 * Map reliability: cold loads, tab switches, list/map, filters, swipe-during-load.
 */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:8080/";
const IPHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

function pendingVisible(html) {
  return html.includes("Loading map") && !html.includes('hidden=""') && !html.includes("hidden=");
}

async function mapState(page) {
  return page.evaluate(() => {
    const canvases = document.querySelectorAll(".uc-map canvas");
    const pending = document.querySelector("[data-uc-map-pending]");
    const pendingShown =
      !!pending &&
      pending.getAttribute("hidden") == null &&
      getComputedStyle(pending).display !== "none";
    const retry = !!document.querySelector("[data-uc-map-pending] button");
    const maps = document.querySelectorAll(".uc-map");
    const perf = window.__ucPerf || [];
    const constructors = perf.filter((r) => r.stage === "map:constructor").length;
    const removes = perf.filter((r) => r.stage === "map:reset").length;
    return {
      canvases: canvases.length,
      maps: maps.length,
      pendingShown,
      retry,
      constructors,
      removes,
      ready: !!pending && pending.hasAttribute("hidden"),
      stages: perf.slice(-12).map((r) => `${r.stage}@${r.t}`),
    };
  });
}

async function waitUsable(page, ms = 8000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const s = await mapState(page);
    if (s.canvases >= 1 && !s.pendingShown) return { ...s, waitMs: Date.now() - start };
    await page.waitForTimeout(80);
  }
  return { ...(await mapState(page)), waitMs: Date.now() - start, timeout: true };
}

const results = [];
const browser = await chromium.launch({ headless: true });

async function coldLoad(i) {
  const ctx = await browser.newContext({
    viewport: IPHONE,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  const usable = await waitUsable(page, 9000);
  const tap = await page.evaluate(() => {
    const t0 = performance.now();
    document.querySelector('[aria-label="Search"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    return Math.round(performance.now() - t0);
  });
  results.push({
    kind: "cold",
    i,
    navMs: Date.now() - t0,
    waitMs: usable.waitMs,
    canvases: usable.canvases,
    pending: usable.pendingShown,
    timeout: !!usable.timeout,
    constructors: usable.constructors,
    tapMs: tap,
    errors: errors.slice(0, 3),
    stages: usable.stages,
  });
  await ctx.close();
}

console.log("=== 20 cold Map view loads ===");
for (let i = 1; i <= 20; i++) {
  await coldLoad(i);
  const last = results[results.length - 1];
  console.log(
    `#${i} wait=${last.waitMs}ms canvas=${last.canvases} pending=${last.pending} ctor=${last.constructors} timeout=${last.timeout} tap=${last.tapMs}ms`,
  );
}

const ctx = await browser.newContext({
  viewport: IPHONE,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await waitUsable(page);

console.log("=== Map ↔ List × 8 ===");
for (let i = 1; i <= 8; i++) {
  await page.getByRole("button", { name: "List", exact: true }).first().click();
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: "Map", exact: true }).first().click();
  const s = await waitUsable(page, 5000);
  console.log(`toggle#${i} wait=${s.waitMs} canvas=${s.canvases} pending=${s.pendingShown} timeout=${!!s.timeout} ctor=${s.constructors}`);
  results.push({ kind: "toggle", i, ...s });
}

console.log("=== Courts ↔ Play tab × 6 ===");
for (let i = 1; i <= 6; i++) {
  await page.getByRole("button", { name: "Play" }).first().click().catch(() => {});
  await page.locator("#uc-bottom-tab-bar, [data-uc-tab-bar]").getByText("Play", { exact: true }).click().catch(async () => {
    await page.evaluate(() => {
      const tabs = [...document.querySelectorAll("button, a")];
      tabs.find((t) => t.textContent?.trim() === "Play")?.click();
    });
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("button, a")];
    tabs.find((t) => t.textContent?.trim() === "Courts")?.click();
  });
  const s = await waitUsable(page, 5000);
  console.log(`tab#${i} wait=${s.waitMs} canvas=${s.canvases} pending=${s.pendingShown} timeout=${!!s.timeout} ctor=${s.constructors}`);
  results.push({ kind: "tab", i, ...s });
}

console.log("=== Filter change ===");
await page.getByRole("button", { name: /Show filters|Hide filters|Filters/i }).first().click();
await page.waitForTimeout(80);
const shade = page.getByRole("button", { name: "Shade" }).first();
if (await shade.count()) await shade.click();
const sFilter = await waitUsable(page, 4000);
console.log(`filter wait=${sFilter.waitMs} canvas=${sFilter.canvases} pending=${sFilter.pendingShown}`);
results.push({ kind: "filter", ...sFilter });

console.log("=== Swipe carousel while map ready ===");
await page.evaluate(() => {
  const scroller = document.querySelector(".uc-map-carousel");
  if (scroller) scroller.scrollLeft += 220;
});
await page.waitForTimeout(200);
const sSwipe = await waitUsable(page, 3000);
console.log(`swipe wait=${sSwipe.waitMs} canvas=${sSwipe.canvases} pending=${sSwipe.pendingShown} ctor=${sSwipe.constructors}`);
results.push({ kind: "swipe", ...sSwipe });

await ctx.close();
await browser.close();

const cold = results.filter((r) => r.kind === "cold");
const fails = results.filter((r) => r.timeout || r.pendingShown || r.pending);
const ctors = cold.map((r) => r.constructors);
const waits = cold.map((r) => r.waitMs);
console.log("\n=== SUMMARY ===");
console.log("cold n=", cold.length);
console.log("cold wait ms min/med/max", Math.min(...waits), waits.sort((a, b) => a - b)[Math.floor(waits.length / 2)], Math.max(...waits));
console.log("cold constructors", ctors);
console.log("failures (pending/timeout)", fails.length);
if (fails.length) {
  console.log(JSON.stringify(fails, null, 2));
  process.exit(1);
}
console.log("PASS: no indefinite loading, map usable on every trial");
