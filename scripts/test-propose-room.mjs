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
await page.waitForTimeout(700);

for (let i = 0; i < 14; i++) {
  const matched = await page.evaluate(() => /It.?s a match/i.test(document.body.innerText));
  if (matched) break;
  const like = page.getByRole("button", { name: /^Like$/i }).first();
  if (!(await like.count())) {
    const reshuffle = page.getByRole("button", { name: /Reshuffle/i }).first();
    if (await reshuffle.count()) await reshuffle.click({ force: true });
    else break;
    await page.waitForTimeout(250);
    continue;
  }
  await like.click({ force: true });
  await page.waitForTimeout(320);
}

const msg = page.getByRole("button", { name: /Message /i }).first();
if (await msg.count()) await msg.click({ force: true });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const send = [...document.querySelectorAll("button")].find((b) =>
    /Send proposed plan/i.test(b.textContent || ""),
  );
  const ball = [...document.querySelectorAll("label")].find((el) =>
    /bring a basketball/i.test(el.textContent || ""),
  );
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const days = [...document.querySelectorAll("button")].filter((b) =>
    /Now|Sat|Sun|Mon|Tue|Wed|Thu|Fri/i.test((b.textContent || "").slice(0, 12)),
  );
  const slots = [...document.querySelectorAll("button")].filter((b) =>
    /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test((b.textContent || "").trim()),
  );
  const visibleSlots = slots.filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 20 && r.top >= 80 && r.bottom <= 844 && r.height > 20;
  });
  const sr = send?.getBoundingClientRect();
  const br = ball?.getBoundingClientRect();
  const tr = tabs?.getBoundingClientRect();
  const uncoveredSlots = visibleSlots.filter((b) => {
    const r = b.getBoundingClientRect();
    return !sr || r.bottom <= sr.top + 2;
  });
  return {
    sendTop: sr ? Math.round(sr.top) : null,
    sendBottom: sr ? Math.round(sr.bottom) : null,
    sendVisible: Boolean(sr && sr.top > 400 && sr.bottom < 830),
    ballTop: br ? Math.round(br.top) : null,
    ballBottom: br ? Math.round(br.bottom) : null,
    ballVisible: Boolean(br && br.top > 200 && br.bottom < (sr?.top ?? 800) + 4),
    tabsTop: tr ? Math.round(tr.top) : null,
    sendAboveTabs: Boolean(sr && tr && sr.bottom <= tr.top + 4),
    ballAboveSend: Boolean(br && sr && br.bottom <= sr.top + 8),
    dayCount: days.length,
    visibleSlotCount: visibleSlots.length,
    uncoveredSlotCount: uncoveredSlots.length,
  };
});

await page.screenshot({ path: "/workspace/screenshots/mm-propose-room.png" });
console.log(info);

await browser.close();
const ok =
  info.sendVisible &&
  info.sendAboveTabs &&
  info.ballVisible &&
  info.ballAboveSend &&
  info.uncoveredSlotCount >= 8 &&
  info.dayCount >= 4;
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
