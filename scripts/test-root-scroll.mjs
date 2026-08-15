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
await page.waitForTimeout(2800);
await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(400);
const mm = page.getByRole("button", { name: /Match Mode/i }).first();
if (await mm.count()) await mm.click({ force: true });
await page.waitForTimeout(600);
for (let i = 0; i < 8; i++) {
  if (await page.getByText("It’s a match").count()) break;
  const like = page.getByRole("button", { name: "Like" });
  if (await like.count()) {
    await like.click({ force: true });
    await page.waitForTimeout(400);
  } else break;
}
const gd = page.getByRole("button", { name: /Game details/i });
if (await gd.count()) await gd.click({ force: true });
await page.waitForTimeout(500);
const sendPlan = page.getByRole("button", { name: /Send proposed plan/i });
if (await sendPlan.count()) await sendPlan.click({ force: true });
await page.waitForTimeout(700);
if (!(await page.locator("[data-uc-match-chat]").count())) {
  console.log("NO_CHAT");
  await browser.close();
  process.exit(1);
}

function audit() {
  return page.evaluate(() => {
    const info = (el, name) => {
      if (!el) return { name, missing: true };
      const cs = getComputedStyle(el);
      return {
        name,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        position: cs.position,
        height: cs.height,
        scrollTop: el.scrollTop,
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight + 2,
      };
    };
    const chat = document.querySelector("[data-uc-match-chat]");
    const msgs = document.querySelector("[data-uc-chat-messages]");
    const tabs = document.getElementById("uc-bottom-tab-bar");
    const shell = document.querySelector(".app-shell");
    return {
      windowY: window.scrollY,
      htmlTop: document.documentElement.scrollTop,
      bodyTop: document.body.scrollTop,
      html: info(document.documentElement, "html"),
      body: info(document.body, "body"),
      shell: info(shell, "app-shell"),
      chat: info(chat, "chat"),
      msgs: info(msgs, "messages"),
      tabs: info(tabs, "tabs"),
      tabsTouch: tabs ? getComputedStyle(tabs).touchAction : null,
    };
  });
}

const before = await audit();

// Drag on tab bar — root must not move
const tabsBox = await page.locator("#uc-bottom-tab-bar").boundingBox();
if (tabsBox) {
  await page.mouse.move(tabsBox.x + tabsBox.width / 2, tabsBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(tabsBox.x + tabsBox.width / 2, tabsBox.y - 120, { steps: 8 });
  await page.mouse.up();
}
await page.mouse.wheel(0, -200);
const afterDrag = await audit();

// Keyboard cycle
await page.locator("[data-uc-match-chat] textarea").click();
await page.waitForTimeout(150);
await page.evaluate(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const proto = Object.getPrototypeOf(vv);
  Object.defineProperty(proto, "height", { configurable: true, get: () => 480 });
  Object.defineProperty(proto, "offsetTop", { configurable: true, get: () => 0 });
  vv.dispatchEvent(new Event("resize"));
});
await page.waitForTimeout(150);
await page.evaluate(() => {
  document.querySelector("[data-uc-match-chat] textarea")?.blur();
});
await page.waitForTimeout(100);
const mid = await page.evaluate(() =>
  Boolean(document.getElementById("uc-bottom-tab-bar")),
);
await page.evaluate(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const proto = Object.getPrototypeOf(vv);
  Object.defineProperty(proto, "height", {
    configurable: true,
    get: () => window.innerHeight,
  });
  Object.defineProperty(proto, "offsetTop", { configurable: true, get: () => 0 });
  vv.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new Event("resize"));
});
await page.waitForTimeout(250);

const afterKb = await audit();
if (tabsBox) {
  await page.mouse.move(tabsBox.x + tabsBox.width / 2, 820);
  await page.mouse.down();
  await page.mouse.move(tabsBox.x + tabsBox.width / 2, 680, { steps: 8 });
  await page.mouse.up();
}
const afterKbDrag = await audit();

await page.screenshot({ path: "/workspace/screenshots/mm-root-scroll.png" });
console.log(JSON.stringify({ before, afterDrag, mid, afterKb, afterKbDrag }, null, 2));

const rootLocked = (a) =>
  a.windowY === 0 &&
  a.htmlTop === 0 &&
  a.bodyTop === 0 &&
  a.html.overflowY === "hidden" &&
  a.body.overflowY === "hidden" &&
  a.shell.overflowY === "hidden" &&
  a.chat.overflowY === "hidden" &&
  a.msgs.overflowY === "auto";

const ok =
  rootLocked(before) &&
  rootLocked(afterDrag) &&
  mid === false &&
  rootLocked(afterKb) &&
  rootLocked(afterKbDrag) &&
  afterKb.tabs.position === "fixed";

await browser.close();
if (!ok) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS — scrolling element is chat messages only; root stays at 0");
