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

for (let i = 0; i < 8; i++) {
  if (await page.getByText("It’s a match").count()) break;
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
  console.log("NO_CHAT");
  await page.screenshot({ path: "/workspace/screenshots/mm-chat-arch-fail.png" });
  await browser.close();
  process.exit(1);
}

const closed = await page.evaluate(() => {
  const root = document.querySelector("[data-uc-match-chat]");
  const ta = root?.querySelector("textarea");
  const composer = root?.querySelector("[data-uc-match-composer]");
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const cs = ta ? getComputedStyle(ta) : null;
  const rs = root ? getComputedStyle(root) : null;
  const cos = composer ? getComputedStyle(composer) : null;
  const cr = composer?.getBoundingClientRect();
  const tr = tabs?.getBoundingClientRect();
  let ancestorTransform = false;
  let n = ta?.parentElement;
  while (n && n !== document.body) {
    const t = getComputedStyle(n).transform;
    if (t && t !== "none") ancestorTransform = true;
    n = n.parentElement;
  }
  return {
    display: rs?.display,
    flexDir: rs?.flexDirection,
    composerPos: cos?.position,
    font: cs ? parseFloat(cs.fontSize) : 0,
    taTransform: cs?.transform,
    ancestorTransform,
    tabsMounted: Boolean(tabs),
    tabsTop: tr ? Math.round(tr.top) : null,
    composerBottom: cr ? Math.round(cr.bottom) : null,
    composerAboveTabs: Boolean(cr && tr && cr.bottom <= tr.top + 4),
    overflowX: document.body.scrollWidth > 392,
    chatH: rs ? rs.height : null,
    chatTop: rs ? rs.top : null,
  };
});

await page.screenshot({ path: "/workspace/screenshots/mm-chat-arch-closed.png" });

const ta = chat.locator("textarea");
await ta.click();
await page.waitForTimeout(200);

const focused = await page.evaluate(() => {
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const root = document.querySelector("[data-uc-match-chat]");
  const ta = root?.querySelector("textarea");
  const composer = root?.querySelector("[data-uc-match-composer]");
  const cr = composer?.getBoundingClientRect();
  const ir = ta?.getBoundingClientRect();
  return {
    tabsMounted: Boolean(tabs),
    caretInside:
      Boolean(ir && cr && ir.top >= cr.top - 1 && ir.bottom <= cr.bottom + 1),
    inputInComposer: Boolean(composer && ta && composer.contains(ta)),
    composerInFlow:
      composer != null && getComputedStyle(composer).position === "static" ||
      getComputedStyle(composer).position === "relative",
  };
});

// Simulate iOS visualViewport shrink (keyboard overlays-content)
await page.evaluate(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const proto = Object.getPrototypeOf(vv);
  Object.defineProperty(proto, "height", { configurable: true, get: () => 480 });
  Object.defineProperty(proto, "offsetTop", { configurable: true, get: () => 0 });
  vv.dispatchEvent(new Event("resize"));
});
await page.waitForTimeout(200);

const kb = await page.evaluate(() => {
  const root = document.querySelector("[data-uc-match-chat]");
  const composer = root?.querySelector("[data-uc-match-composer]");
  const header = root?.querySelector("header");
  const ta = root?.querySelector("textarea");
  const rr = root?.getBoundingClientRect();
  const cr = composer?.getBoundingClientRect();
  const hr = header?.getBoundingClientRect();
  const chatVh = getComputedStyle(document.documentElement).getPropertyValue("--chat-vh").trim();
  return {
    tabsMounted: Boolean(document.getElementById("uc-bottom-tab-bar")),
    chatVh,
    rootH: rr ? Math.round(rr.height) : null,
    rootTop: rr ? Math.round(rr.top) : null,
    headerTop: hr ? Math.round(hr.top) : null,
    composerBottom: cr ? Math.round(cr.bottom) : null,
    inputBottom: ta ? Math.round(ta.getBoundingClientRect().bottom) : null,
    composerAtChatBottom: Boolean(rr && cr && Math.abs(cr.bottom - rr.bottom) <= 2),
    noHScroll: document.body.scrollWidth <= 392,
    width: Math.round(document.body.getBoundingClientRect().width),
  };
});

await page.locator("textarea").fill("See you at the court");
await chat.getByRole("button", { name: "Send" }).click();
await page.waitForTimeout(200);

// Blur while viewport is still the keyboard size — nav must stay gone
await page.evaluate(() => {
  document.querySelector("[data-uc-match-chat] textarea")?.blur();
});
await page.waitForTimeout(120);
const midDismiss = await page.evaluate(() => ({
  tabsMounted: Boolean(document.getElementById("uc-bottom-tab-bar")),
}));

// Viewport finishes restoring (keyboard animation done)
await page.evaluate(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const proto = Object.getPrototypeOf(vv);
  Object.defineProperty(proto, "height", {
    configurable: true,
    get: () => window.innerHeight,
  });
  Object.defineProperty(proto, "offsetTop", {
    configurable: true,
    get: () => 0,
  });
  vv.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new Event("resize"));
});
await page.waitForTimeout(200);

const after = await page.evaluate(() => {
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const tr = tabs?.getBoundingClientRect();
  const composer = document.querySelector("[data-uc-match-composer]");
  const cr = composer?.getBoundingClientRect();
  return {
    tabsMounted: Boolean(tabs),
    tabsBottom: tr ? Math.round(tr.bottom) : null,
    tabsTop: tr ? Math.round(tr.top) : null,
    tabsAtBottom: Boolean(tr && Math.abs(tr.bottom - 844) <= 2),
    composerAboveTabs: Boolean(cr && tr && cr.bottom <= tr.top + 4),
    sent: /See you at the court/.test(document.body.innerText),
  };
});

await page.screenshot({ path: "/workspace/screenshots/mm-chat-arch-after.png" });
console.log({ closed, focused, kb, midDismiss, after });

await browser.close();
const ok =
  closed.display === "flex" &&
  closed.flexDir === "column" &&
  closed.composerPos !== "absolute" &&
  closed.composerPos !== "fixed" &&
  closed.font >= 16 &&
  closed.taTransform === "none" &&
  !closed.ancestorTransform &&
  closed.tabsMounted &&
  closed.composerAboveTabs &&
  !closed.overflowX &&
  !focused.tabsMounted &&
  focused.caretInside &&
  focused.inputInComposer &&
  !kb.tabsMounted &&
  kb.rootH != null &&
  kb.rootH <= 482 &&
  kb.composerAtChatBottom &&
  kb.noHScroll &&
  kb.width <= 390 &&
  !midDismiss.tabsMounted &&
  after.tabsMounted &&
  after.tabsAtBottom &&
  after.composerAboveTabs &&
  after.sent;
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
