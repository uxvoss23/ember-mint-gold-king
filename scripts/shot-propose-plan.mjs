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
await page.waitForSelector("#uc-bottom-tab-bar", { timeout: 8000 });
await page.getByRole("button", { name: /^Play$/i }).first().click({ force: true });
await page.waitForTimeout(400);
const mm = page.getByRole("button", { name: /Match Mode/i }).first();
if (await mm.count()) await mm.click({ force: true });
await page.waitForTimeout(500);
for (let i = 0; i < 8; i++) {
  if (await page.getByText("It’s a match").count()) break;
  const like = page.getByRole("button", { name: "Like" });
  if (await like.count()) {
    await like.click({ force: true });
    await page.waitForTimeout(350);
  } else break;
}
const gd = page.getByRole("button", { name: /Game details/i });
if (await gd.count()) await gd.click({ force: true });
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/propose-plan.png" });
const text = await page.evaluate(() => document.body.innerText.slice(0, 800));
console.log(text);
await browser.close();
