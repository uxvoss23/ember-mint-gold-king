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
await page.waitForTimeout(500);
const create = page.getByRole("button", { name: /Create game/i }).first();
if (await create.count()) await create.click({ force: true });
await page.waitForTimeout(800);

const report = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button")).map((b) =>
    (b.textContent || "").replace(/\s+/g, " ").trim(),
  );
  const cta = Array.from(document.querySelectorAll("button")).find((b) =>
    /Post public match|Select a court to continue|Select date|Answer ball|Invite someone for private/i.test(
      b.textContent || "",
    ),
  );
  const nav = document.getElementById("uc-bottom-tab-bar");
  const createH = Array.from(document.querySelectorAll("h3")).find((h) =>
    /Create 1v1/i.test(h.textContent || ""),
  );
  if (!cta) {
    return {
      mounted: false,
      matchingButtons: buttons.filter((t) => /post|court|invite|create/i.test(t)),
      allButtonsTail: buttons.slice(-15),
      createHeading: Boolean(createH),
    };
  }
  const cs = getComputedStyle(cta);
  const r = cta.getBoundingClientRect();
  const parents = [];
  let n = cta.parentElement;
  while (n && n !== document.documentElement) {
    const p = getComputedStyle(n);
    const pr = n.getBoundingClientRect();
    parents.push({
      tag: n.tagName,
      id: n.id || "",
      cls: (n.className || "").toString().slice(0, 100),
      display: p.display,
      overflow: `${p.overflowX}/${p.overflowY}`,
      position: p.position,
      height: p.height,
      clientH: n.clientHeight,
      rect: {
        top: +pr.top.toFixed(1),
        bottom: +pr.bottom.toFixed(1),
        height: +pr.height.toFixed(1),
      },
      clips:
        p.overflowY === "hidden" ||
        p.overflowY === "clip" ||
        p.overflow === "hidden",
    });
    n = n.parentElement;
  }
  const navR = nav?.getBoundingClientRect();
  const clipParent = parents.find(
    (p) => p.clips && r.bottom > p.rect.bottom + 0.5,
  );
  let reason = "visible";
  if (cs.display === "none") reason = "display:none";
  else if (cs.visibility === "hidden") reason = "visibility:hidden";
  else if (Number(cs.opacity) === 0) reason = "opacity:0";
  else if (r.height < 1) reason = "zero height";
  else if (r.bottom <= 0) reason = "above viewport";
  else if (r.top >= window.innerHeight) reason = "below viewport";
  else if (navR && r.top >= navR.top - 2) reason = "behind or below nav";
  else if (clipParent)
    reason = `clipped by ${clipParent.tag}.${clipParent.cls.slice(0, 40)}`;
  const scroller = document.querySelector("[data-uc-create-scroll]");
  return {
    mounted: true,
    text: (cta.textContent || "").replace(/\s+/g, " ").trim(),
    parent: {
      tag: cta.parentElement?.tagName,
      cls: (cta.parentElement?.className || "").toString(),
    },
    computed: {
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      position: cs.position,
      top: cs.top,
      bottom: cs.bottom,
      height: cs.height,
      zIndex: cs.zIndex,
    },
    rect: {
      top: +r.top.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      height: +r.height.toFixed(1),
      width: +r.width.toFixed(1),
    },
    nav: navR
      ? { top: +navR.top.toFixed(1), bottom: +navR.bottom.toFixed(1) }
      : null,
    innerHeight: window.innerHeight,
    insideScroller: Boolean(scroller?.contains(cta)),
    scrollerExists: Boolean(scroller),
    reason,
    clipParent: clipParent || null,
    parents: parents.slice(0, 8),
  };
});

console.log(JSON.stringify(report, null, 2));
await page.screenshot({
  path: "/workspace/screenshots/cta-dom.png",
  fullPage: false,
});
await browser.close();
