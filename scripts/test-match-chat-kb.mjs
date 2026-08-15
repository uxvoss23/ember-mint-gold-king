import { chromium } from "playwright";
import fs from "fs";

fs.mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

const logs = [];
page.on("console", (m) => {
  if (m.type() === "error") logs.push(m.text());
});
page.on("pageerror", (e) => logs.push(String(e)));

await page.goto("http://127.0.0.1:8080/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(4000);

await page.getByRole("button", { name: /^play$/i }).first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /match mode/i }).first().click();
await page.waitForTimeout(600);

// Soft availability wizard if present
for (const label of [
  /next · time of day/i,
  /next · travel/i,
  /start matching/i,
]) {
  const btn = page.getByRole("button", { name: label });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForTimeout(350);
  }
}

// Like until match celebration
for (let i = 0; i < 15; i++) {
  const body = await page.locator("body").innerText();
  if (/it.?s a match|finalize|chat first/i.test(body)) break;
  const like = page.getByRole("button", { name: /^like$/i });
  if (!(await like.count())) break;
  await like.first().click();
  await page.waitForTimeout(450);
}

// Finalize → lock plan
const finalize = page.getByRole("button", { name: /finalize/i });
if (await finalize.count()) {
  await finalize.first().click();
  await page.waitForTimeout(500);
}

// Lock plan: Yes ball + Send plan
const yesBall = page.getByRole("button", { name: /^yes$/i });
const sendPlan = page.getByRole("button", { name: /send plan/i });
if ((await yesBall.count()) && (await sendPlan.count())) {
  await yesBall.first().click();
  await page.waitForTimeout(200);
  await sendPlan.first().click();
  await page.waitForTimeout(700);
}

// Or chat first path
if (!(await page.locator('[data-uc-match-chat="1"]').count())) {
  const chatFirst = page.getByRole("button", { name: /chat first/i });
  if (await chatFirst.count()) {
    await chatFirst.first().click();
    await page.waitForTimeout(500);
  }
}

const chat = page.locator('[data-uc-match-chat="1"]');
await chat.waitFor({ state: "visible", timeout: 12000 });

const input = page.locator('[data-uc-match-composer="1"] input');
await input.waitFor({ state: "visible", timeout: 5000 });

const fontSize = await input.evaluate((el) => getComputedStyle(el).fontSize);

await input.click();
await page.waitForTimeout(200);

const before = await page.evaluate(() => {
  const input = document.querySelector('[data-uc-match-composer="1"] input');
  const composer = document.querySelector('[data-uc-match-composer="1"]');
  const shell = document.querySelector('[data-uc-match-chat="1"]');
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const ir = input?.getBoundingClientRect();
  const cr = composer?.getBoundingClientRect();
  const sr = shell?.getBoundingClientRect();
  return {
    chatOpen: document.documentElement.getAttribute("data-uc-chat-open"),
    tabDisplay: tabs ? getComputedStyle(tabs).display : "missing",
    tabVisibility: tabs ? getComputedStyle(tabs).visibility : "missing",
    inputBottom: ir?.bottom,
    composerBottom: cr?.bottom,
    shellTop: sr?.top,
    shellHeight: sr?.height,
    fontSize: input ? getComputedStyle(input).fontSize : null,
  };
});

// Simulate iOS keyboard: shrink visualViewport by 320px
await page.evaluate(() => {
  const KB = 320;
  const vv = window.visualViewport;
  if (!vv) return;
  Object.defineProperty(vv, "height", {
    configurable: true,
    get() {
      return window.innerHeight - KB;
    },
  });
  Object.defineProperty(vv, "offsetTop", {
    configurable: true,
    get() {
      return 0;
    },
  });
  vv.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new Event("resize"));
});

await page.waitForTimeout(700);

const after = await page.evaluate(() => {
  const input = document.querySelector('[data-uc-match-composer="1"] input');
  const composer = document.querySelector('[data-uc-match-composer="1"]');
  const shell = document.querySelector('[data-uc-match-chat="1"]');
  const tabs = document.getElementById("uc-bottom-tab-bar");
  const ir = input?.getBoundingClientRect();
  const cr = composer?.getBoundingClientRect();
  const sr = shell?.getBoundingClientRect();
  const vv = window.visualViewport;
  const body = document.body.innerText;
  return {
    chatOpen: document.documentElement.getAttribute("data-uc-chat-open"),
    tabDisplay: tabs ? getComputedStyle(tabs).display : "missing",
    tabVisibility: tabs ? getComputedStyle(tabs).visibility : "missing",
    inputBottom: ir?.bottom,
    inputTop: ir?.top,
    composerBottom: cr?.bottom,
    shellTop: sr?.top,
    shellHeight: sr?.height,
    vvHeight: vv?.height,
    layoutH: window.innerHeight,
    fontSize: input ? getComputedStyle(input).fontSize : null,
    textHasYouAre: /You are bringing a basketball/i.test(body),
    textHasYouIs: /You is bringing/i.test(body),
    proposedPlan: /Proposed plan/i.test(body),
  };
});

await page.screenshot({
  path: "/workspace/screenshots/mm-kb-fixed.png",
  fullPage: false,
});

await input.type("hey kai", { delay: 40 });
await page.waitForTimeout(250);
await page.screenshot({
  path: "/workspace/screenshots/mm-kb-typing.png",
  fullPage: false,
});

const typing = await page.evaluate(() => {
  const input = document.querySelector('[data-uc-match-composer="1"] input');
  const ir = input?.getBoundingClientRect();
  const vvH = window.visualViewport?.height ?? window.innerHeight;
  return {
    value: input?.value,
    inputBottom: ir?.bottom,
    fullyVisible: ir ? ir.top >= 0 && ir.bottom <= vvH + 2 : false,
    aboveKeyboard: ir ? ir.bottom <= vvH + 2 : false,
    vvH,
  };
});

// Blur and ensure unlock path doesn't leave black gap when leaving chat
await input.blur();
await page.waitForTimeout(200);
const back = page.getByRole("button", { name: /back to matches/i });
if (await back.count()) {
  await back.first().click();
  await page.waitForTimeout(500);
}
const afterLeave = await page.evaluate(() => {
  const tabs = document.getElementById("uc-bottom-tab-bar");
  return {
    chatOpen: document.documentElement.getAttribute("data-uc-chat-open"),
    tabDisplay: tabs ? getComputedStyle(tabs).display : "missing",
    tabBottom: tabs ? tabs.getBoundingClientRect().bottom : null,
    tabTop: tabs ? tabs.getBoundingClientRect().top : null,
    tabFixed: tabs ? getComputedStyle(tabs).position : null,
    tabCssBottom: tabs ? getComputedStyle(tabs).bottom : null,
    layoutH: window.innerHeight,
  };
});
await page.screenshot({
  path: "/workspace/screenshots/mm-tabs-restored.png",
  fullPage: false,
});

const results = { fontSize, before, after, typing, afterLeave, consoleErrors: logs.slice(0, 8) };
console.log(JSON.stringify(results, null, 2));

let failed = false;
const fail = (m) => {
  console.error("FAIL:", m);
  failed = true;
};

if (fontSize !== "16px" && after.fontSize !== "16px")
  fail(`font-size not 16px: ${fontSize} / ${after.fontSize}`);
if (after.chatOpen !== "1") fail("data-uc-chat-open not set while chat open");
if (after.tabDisplay !== "none")
  fail(`tabs not hidden while chat: display=${after.tabDisplay}`);
if (after.shellHeight == null || after.shellHeight > 560)
  fail(`shell not VV-sized (~524): got ${after.shellHeight}`);
if (!typing.aboveKeyboard)
  fail(`input covered: bottom=${typing.inputBottom} vvH=${typing.vvH}`);
if (after.textHasYouIs) fail('found "You is bringing"');
if (!after.textHasYouAre && after.proposedPlan)
  fail('proposal present but missing "You are bringing"');
if (!after.textHasYouAre)
  console.warn('WARN: no "You are bringing" (check proposal path)');
if (afterLeave.chatOpen === "1") fail("chat-open still set after leave");
if (afterLeave.tabDisplay === "none")
  fail("tabs still hidden after leave chat");
if (
  afterLeave.tabBottom != null &&
  Math.abs(afterLeave.tabBottom - afterLeave.layoutH) > 4
)
  fail(
    `tabs not pinned to bottom after leave: bottom=${afterLeave.tabBottom} layoutH=${afterLeave.layoutH}`,
  );

if (failed) process.exitCode = 2;
else console.log("PASS match chat keyboard layout");

await browser.close();
