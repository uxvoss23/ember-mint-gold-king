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
await page.waitForTimeout(3200);
await page.getByRole("button", { name: /^Play$/i }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Match Mode/i }).first().click();
await page.waitForTimeout(700);
for (const label of ["Next · time of day", "Next · travel", "Start matching"]) {
  const btn = page.getByRole("button", { name: label });
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(280);
  }
}

await page.getByRole("button", { name: /Filters/i }).first().click();
await page.waitForTimeout(400);

const apply = page.getByRole("button", { name: /^Apply$/ });
await apply.waitFor({ state: "visible", timeout: 4000 });

const info = await page.evaluate(() => {
  const applyBtn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Apply",
  );
  const ethnicity = [...document.querySelectorAll("p,button,span")].find((el) =>
    /Ethnicity|Pacific Islander/.test(el.textContent || ""),
  );
  const ar = applyBtn?.getBoundingClientRect();
  const tab = document.getElementById("uc-bottom-tab-bar")?.getBoundingClientRect();
  const sheet = applyBtn?.closest(".fixed.flex.flex-col");
  const sheetScroll = sheet?.querySelector(".overflow-y-auto");
  return {
    applyTop: ar ? Math.round(ar.top) : null,
    applyBottom: ar ? Math.round(ar.bottom) : null,
    applyVisible: !!(ar && ar.height > 0 && ar.bottom < 844 && ar.top > 0),
    tabTop: tab ? Math.round(tab.top) : null,
    applyAboveTabs: !!(ar && tab && ar.bottom <= tab.top + 4),
    canScrollSheet: sheetScroll
      ? sheetScroll.scrollHeight > sheetScroll.clientHeight
      : false,
    scrollH: sheetScroll?.scrollHeight ?? 0,
    clientH: sheetScroll?.clientHeight ?? 0,
    hasEthnicity: !!ethnicity,
  };
});

await page.screenshot({
  path: "/workspace/screenshots/mm-filters-scroll.png",
  fullPage: false,
});

if (sheetScrollable(info)) {
  await page.evaluate(() => {
    const applyBtn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Apply",
    );
    const sheet = applyBtn?.closest(".fixed.flex.flex-col");
    const sc = sheet?.querySelector(".overflow-y-auto");
    if (sc) sc.scrollTop = sc.scrollHeight;
  });
}

function sheetScrollable(i) {
  return i.canScrollSheet || i.scrollH > i.clientH;
}

await page.screenshot({
  path: "/workspace/screenshots/mm-filters-scrolled.png",
  fullPage: false,
});

console.log(JSON.stringify(info, null, 2));
await browser.close();

if (!info.applyVisible || !info.applyAboveTabs) {
  console.error("FAIL: Apply not fully visible above tabs");
  process.exit(1);
}
console.log("PASS");
