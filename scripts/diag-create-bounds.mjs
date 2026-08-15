#!/usr/bin/env node
import { chromium } from "playwright";

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
await page.waitForSelector("#uc-bottom-tab-bar", { timeout: 8000 });
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(400);
const create = page.getByRole("button", { name: /Create game/i }).first();
if (await create.count()) await create.click({ force: true });
await page.waitForTimeout(700);

const report = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      top: +r.top.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      height: +r.height.toFixed(1),
      position: cs.position,
      inset: `${cs.top}/${cs.right}/${cs.bottom}/${cs.left}`,
      heightCS: cs.height,
      overflow: cs.overflow,
      display: cs.display,
      padB: cs.paddingBottom,
      cls: (el.className || "").toString().slice(0, 90),
    };
  };
  const heading = Array.from(document.querySelectorAll("h3")).find((h) =>
    /Create 1v1/i.test(h.textContent || ""),
  );
  const scroller = document.querySelector("[data-uc-create-scroll]");
  const grid = scroller?.parentElement;
  const footer = grid?.querySelector(":scope > div:nth-child(2)");
  const cta = Array.from(document.querySelectorAll("button")).find((b) =>
    /Post public match|Select a court/i.test(b.textContent || ""),
  );
  const nav = document.getElementById("uc-bottom-tab-bar");
  const navR = nav?.getBoundingClientRect();
  const gridR = grid?.getBoundingClientRect();
  return {
    tabH: getComputedStyle(document.documentElement)
      .getPropertyValue("--uc-tab-h")
      .trim(),
    grid: box(grid),
    scroller: box(scroller),
    footer: box(footer),
    cta: box(cta),
    nav: box(nav),
    gridBottomBelowNavTop:
      gridR && navR ? gridR.bottom > navR.top + 1 : null,
    overlapPx:
      gridR && navR ? +(gridR.bottom - navR.top).toFixed(1) : null,
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
