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

const snap = (label) =>
  page.evaluate((lab) => {
    const h = document.documentElement;
    const b = document.body;
    return {
      t: Math.round(performance.now()),
      label: lab,
      booting: h.getAttribute("data-uc-booting"),
      tabs: Boolean(document.getElementById("uc-bottom-tab-bar")),
      html: {
        position: h.style.position || "(empty)",
        overflow: h.style.overflow || "(empty)",
        top: h.style.top || "(empty)",
        height: h.style.height || "(empty)",
        inset: h.style.inset || "(empty)",
      },
      body: {
        position: b.style.position || "(empty)",
        overflow: b.style.overflow || "(empty)",
        top: b.style.top || "(empty)",
        height: b.style.height || "(empty)",
        inset: b.style.inset || "(empty)",
      },
      windowY: window.scrollY,
      htmlTop: h.scrollTop,
      bodyTop: b.scrollTop,
    };
  }, label);

const out = [];
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
out.push(await snap("after-domcontent"));
for (const ms of [200, 600, 1200, 1800, 2600]) {
  await page.waitForTimeout(ms === 200 ? 200 : 400);
  out.push(await snap(`poll-${ms}ms`));
}
try {
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-uc-booting") !== "1",
    { timeout: 6000 },
  );
} catch {
  /* splash still up */
}
out.push(await snap("after-splash-wait"));
await page.waitForTimeout(250);
out.push(await snap("tabs-settled"));

const play = page.getByRole("button", { name: /^Play$/i }).first();
if (await play.count()) {
  await play.click({ force: true });
  out.push(await snap("play-click-immediate"));
  await page.waitForTimeout(16);
  out.push(await snap("play-click-+16ms"));
  await page.waitForTimeout(80);
  out.push(await snap("play-click-+96ms"));
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
