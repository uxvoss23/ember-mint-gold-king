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
await page.waitForTimeout(600);
await page.getByText("Create 1v1").first().waitFor({ timeout: 5000 }).catch(() => {});

const report = await page.evaluate(() => {
  const cta = Array.from(document.querySelectorAll("button")).find((b) =>
    /Post public match|Select a court to continue|Select date/i.test(b.textContent || ""),
  );
  const nav = document.getElementById("uc-bottom-tab-bar");
  const heading = Array.from(document.querySelectorAll("h3")).find((h) =>
    /Create 1v1/i.test(h.textContent || ""),
  );
  const chain = [];
  let n = heading?.parentElement ?? null;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    chain.push({
      tag: n.tagName,
      cls: (n.className || "").toString().slice(0, 90),
      overflowY: cs.overflowY,
      position: cs.position,
      height: cs.height,
      flex: `${cs.flexGrow}/${cs.flexShrink}/${cs.flexBasis}`,
      minH: cs.minHeight,
      clientH: n.clientHeight,
      scrollH: n.scrollHeight,
      scrollTop: n.scrollTop,
      maxScroll: n.scrollHeight - n.clientHeight,
      padB: cs.paddingBottom,
    });
    n = n.parentElement;
  }
  const scrollers = chain.filter(
    (c) => c.overflowY === "auto" || c.overflowY === "scroll",
  );
  let atMax = null;
  if (cta) {
    const scrollerEl = heading?.parentElement;
    if (scrollerEl) {
      scrollerEl.scrollTop = scrollerEl.scrollHeight - scrollerEl.clientHeight;
    }
    const cr = cta.getBoundingClientRect();
    const nr = nav?.getBoundingClientRect();
    atMax = {
      scrollerMax: scrollerEl
        ? {
            scrollTop: scrollerEl.scrollTop,
            max: scrollerEl.scrollHeight - scrollerEl.clientHeight,
            scrollH: scrollerEl.scrollHeight,
            clientH: scrollerEl.clientHeight,
            padB: getComputedStyle(scrollerEl).paddingBottom,
          }
        : null,
      cta: {
        top: +cr.top.toFixed(1),
        bottom: +cr.bottom.toFixed(1),
        position: getComputedStyle(cta).position,
        insideScroller: Boolean(heading?.parentElement?.contains(cta)),
      },
      nav: nr
        ? { top: +nr.top.toFixed(1), bottom: +nr.bottom.toFixed(1) }
        : null,
      tabH: getComputedStyle(document.documentElement).getPropertyValue(
        "--uc-tab-h",
      ),
      clears: nr ? cr.bottom <= nr.top - 24 : null,
      gap: nr ? +(nr.top - cr.bottom).toFixed(1) : null,
    };
  }
  return {
    headingParentIsScroller: heading
      ? /auto|scroll/.test(getComputedStyle(heading.parentElement).overflowY)
      : null,
    scrollers,
    chain,
    atMax,
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
