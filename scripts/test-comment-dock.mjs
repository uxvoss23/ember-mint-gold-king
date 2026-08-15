import { chromium } from "playwright";
import fs from "fs";
fs.mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /courts/i }).first().click().catch(()=>{});
await page.waitForTimeout(400);
const write = page.getByRole("button", { name: /^Write$/i });
if (await write.count()) await write.first().click();
else await page.getByRole("button", { name: /Add a comment/i }).first().click();
const input = page.locator('input[placeholder="What are you seeing?"]');
await input.waitFor({ state: "visible" });
await input.fill("Hey");
const metrics = await input.evaluate((el) => {
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName,
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    height: cs.height,
    padding: cs.padding,
    transform: cs.transform,
    value: el.value,
  };
});
const box = await input.boundingBox();
await page.screenshot({ path: "/workspace/screenshots/comment-single-line.png" });
console.log(JSON.stringify({ metrics, box }, null, 2));
const ok = metrics.tag === "INPUT" && metrics.transform === "none" && metrics.value === "Hey" && box.y > 400;
if (!ok) process.exitCode = 2;
else console.log("PASS single-line input");
await browser.close();
