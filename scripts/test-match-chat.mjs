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

// Instant-match: swipe right until celebration (demo likes-you set)
for (let i = 0; i < 8; i++) {
  const cele = await page.getByText("It’s a match").count();
  if (cele) break;
  const like = page.getByRole("button", { name: "Like" });
  if (await like.count()) {
    await like.click({ force: true });
    await page.waitForTimeout(500);
  } else break;
}

const gd = page.getByRole("button", { name: /Game details/i });
if (await gd.count()) {
  await gd.click({ force: true });
  await page.waitForTimeout(600);
}

const sendPlan = page.getByRole("button", { name: /Send proposed plan/i });
if (await sendPlan.count()) {
  await sendPlan.click({ force: true });
  await page.waitForTimeout(800);
}

// If we landed on matches instead, open first
if (!(await page.locator("[data-uc-match-chat]").count())) {
  const matchesBtn = page.getByRole("button", { name: /^Matches$/i });
  if (await matchesBtn.count()) await matchesBtn.click({ force: true });
  await page.waitForTimeout(400);
  const row = page.locator("button").filter({ hasText: /plan waiting|tap to set/i }).first();
  if (await row.count()) await row.click({ force: true });
  await page.waitForTimeout(800);
}

const chat = page.locator("[data-uc-match-chat]");
if (!(await chat.count())) {
  console.log("NO_CHAT", (await page.locator("body").innerText()).slice(0, 400));
  await page.screenshot({ path: "/workspace/screenshots/mm-chat-fail.png" });
  await browser.close();
  process.exit(1);
}

const ta = chat.locator("textarea");
await ta.click();
await page.waitForTimeout(200);
await ta.fill("See you at the court");
await chat.getByRole("button", { name: "Send" }).click();
await page.waitForTimeout(400);

const closed = await page.evaluate(() => {
  const root = document.querySelector("[data-uc-match-chat]");
  const ta = root?.querySelector("textarea");
  const header = root?.querySelector("header");
  const composer = root?.querySelector("[data-uc-match-composer]");
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const cs = ta ? getComputedStyle(ta) : null;
  const hr = header?.getBoundingClientRect();
  const cr = composer?.getBoundingClientRect();
  const tr = tabs?.getBoundingClientRect();
  const body = document.body;
  return {
    hasChat: Boolean(root),
    compact: /MATCH/i.test(root?.innerText ?? "") && /View \/ Edit Plan/i.test(root?.innerText ?? ""),
    noGiant: !/Proposed plan/i.test(root?.innerText ?? ""),
    sent: /See you at the court/.test(root?.innerText ?? ""),
    font: cs ? parseFloat(cs.fontSize) : 0,
    headerTop: hr ? Math.round(hr.top) : null,
    headerVisible: Boolean(hr && hr.top >= 0 && hr.height > 20),
    composerBottom: cr ? Math.round(cr.bottom) : null,
    composerVisible: Boolean(cr && cr.height > 20 && cr.bottom <= 844 + 2),
    overflowX: body.scrollWidth > 390 + 2 || (root?.scrollWidth ?? 0) > 390 + 2,
    pageWidth: Math.round(body.getBoundingClientRect().width),
    tabsVisible: Boolean(tr && tr.height > 20 && getComputedStyle(tabs).visibility !== "hidden"),
    tabsTop: tr ? Math.round(tr.top) : null,
    composerAboveTabs: Boolean(cr && tr && cr.bottom <= tr.top + 4),
    matchChatOpen: document.documentElement.getAttribute("data-uc-match-chat-open") === "1",
  };
});

await page.screenshot({ path: "/workspace/screenshots/mm-chat-closed.png" });

// Simulate software keyboard: visualViewport shrinks, layout viewport stays
await page.evaluate(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const fakeH = 480;
  const proto = Object.getPrototypeOf(vv);
  Object.defineProperty(proto, "height", { configurable: true, get: () => fakeH });
  Object.defineProperty(proto, "offsetTop", { configurable: true, get: () => 0 });
  vv.dispatchEvent(new Event("resize"));
});
await page.waitForTimeout(250);
await ta.click();
await page.waitForTimeout(200);

const open = await page.evaluate(() => {
  const root = document.querySelector("[data-uc-match-chat]");
  const ta = root?.querySelector("textarea");
  const header = root?.querySelector("header");
  const composer = root?.querySelector("[data-uc-match-composer]");
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const hr = header?.getBoundingClientRect();
  const cr = composer?.getBoundingClientRect();
  const tr = tabs ? getBoundingClientRectSafe(tabs) : null;
  const kb = Math.round(window.innerHeight - (window.visualViewport?.height ?? window.innerHeight));
  function getBoundingClientRectSafe(el) {
    return el.getBoundingClientRect();
  }
  const tabHidden =
    !tabs ||
    getComputedStyle(tabs).display === "none" ||
    getComputedStyle(tabs).visibility === "hidden";
  return {
    kbInset: kb,
    headerStillTop: Boolean(hr && hr.top >= 0 && hr.top < 80 && hr.height > 20),
    composerVisible: Boolean(cr && cr.height > 20 && cr.bottom <= 844 + 2),
    inputVisible: Boolean(ta && ta.getBoundingClientRect().bottom <= 844),
    composerAboveKb: Boolean(cr && cr.bottom <= 480 + 8),
    noHScroll: document.body.scrollWidth <= 392,
    widthStill: Math.round(document.body.getBoundingClientRect().width),
    tabHidden,
    tabsDisplay: tabs ? getComputedStyle(tabs).display : null,
    overlayBottom: root ? getComputedStyle(root).bottom : null,
  };
});

await page.screenshot({ path: "/workspace/screenshots/mm-chat-kb.png" });
console.log({ closed, open });

await browser.close();
const ok =
  closed.hasChat &&
  closed.compact &&
  closed.noGiant &&
  closed.sent &&
  closed.font >= 16 &&
  closed.headerVisible &&
  closed.composerVisible &&
  !closed.overflowX &&
  closed.pageWidth <= 390 &&
  closed.tabsVisible &&
  closed.composerAboveTabs &&
  open.headerStillTop &&
  open.composerVisible &&
  open.inputVisible &&
  open.noHScroll &&
  open.widthStill <= 390;
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
