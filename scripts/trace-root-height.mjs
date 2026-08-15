#!/usr/bin/env node
/** Diagnostic only. Does not modify app source. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

function pack() {
  const vv = window.visualViewport;
  const box = (el, name) => {
    if (!el) return { name, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      name,
      top: +r.top.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      height: +r.height.toFixed(1),
      position: cs.position,
      inset: `${cs.top}/${cs.right}/${cs.bottom}/${cs.left}`,
      heightCS: cs.height,
      overflow: cs.overflow,
      inlinePosition: el.style.position,
      inlineInset: el.style.inset,
    };
  };
  const html = document.documentElement;
  const body = document.body;
  const shell = document.querySelector(".app-shell");
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const inner = window.innerHeight;
  const vvh = vv?.height ?? null;
  const vvo = vv?.offsetTop ?? null;
  const candidates = [html, body, shell, tabs].filter(Boolean);
  const bottoms = candidates.map((el) => ({
    name: el.id || el.className?.toString?.().slice(0, 24) || el.tagName,
    bottom: el.getBoundingClientRect().bottom,
  }));
  const shortest = bottoms.reduce((a, b) => (a.bottom <= b.bottom ? a : b));
  return {
    innerHeight: inner,
    visualViewportHeight: vvh,
    visualViewportOffsetTop: vvo,
    screenH: window.screen?.height ?? null,
    gapBelowShortest: +(inner - shortest.bottom).toFixed(1),
    shortest,
    html: box(html, "html"),
    body: box(body, "body"),
    shell: box(shell, "app-shell"),
    tabs: box(tabs, "tabs"),
  };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
const early = await page.evaluate(pack);
await page.waitForSelector("#uc-bottom-tab-bar", { timeout: 8000 });
await page.waitForTimeout(400);
const locked = await page.evaluate(pack);
await page.screenshot({
  path: "/workspace/screenshots/diag-root-height-locked.png",
  fullPage: false,
});

// In-session only: strip position/inset from html+body, keep overflow hidden
const unlockedFixed = await page.evaluate(() => {
  for (const n of [document.documentElement, document.body]) {
    n.style.removeProperty("position");
    n.style.removeProperty("inset");
    n.style.removeProperty("top");
    n.style.removeProperty("right");
    n.style.removeProperty("bottom");
    n.style.removeProperty("left");
    n.style.overflow = "hidden";
  }
});
void unlockedFixed;
await page.waitForTimeout(50);
const afterStrip = await page.evaluate(pack);
await page.screenshot({
  path: "/workspace/screenshots/diag-root-height-no-fixed.png",
  fullPage: false,
});

// Simulate iOS Safari chrome retracting: layout viewport grows, visual was short
// Restore lock styles as ViewportLock would, then grow the page viewport
await page.evaluate(() => {
  for (const n of [document.documentElement, document.body]) {
    n.style.position = "fixed";
    n.style.inset = "0";
    n.style.overflow = "hidden";
  }
});
await page.setViewportSize({ width: 390, height: 844 });
const mid = await page.evaluate(pack);
await page.setViewportSize({ width: 390, height: 932 });
await page.waitForTimeout(80);
const grown = await page.evaluate(pack);

console.log(
  JSON.stringify(
    { early, locked, afterStripFixedInset: afterStrip, sameSizeRelock: mid, afterGrowTo932: grown },
    null,
    2,
  ),
);
await browser.close();
