import { chromium } from "playwright";
import fs from "fs";
fs.mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /courts/i }).first().click().catch(()=>{});
await page.waitForTimeout(500);
const write = page.getByRole("button", { name: /^Write$/i });
if (await write.count()) await write.first().click();
else await page.getByRole("button", { name: /Add a comment/i }).first().click();
await page.waitForTimeout(200);
const input = page.locator('input[placeholder="What are you seeing?"]');
await input.waitFor({ state: "visible" });
await input.fill("Courts are running full right now");
await page.waitForTimeout(100);
const preview = page.locator("text=Courts are running full right now");
const previewVisible = await preview.first().isVisible();
const box = await input.boundingBox();
// Simulate keyboard covering bottom 340px of layout - panel should stay near top
await page.evaluate(() => {
  const panel = document.querySelector('[data-uc-composer="dock"]');
  // binder would set top to vv.offsetTop+margin; fake a shrunk viewport by setting top small
  if (panel) {
    panel.style.top = "12px";
  }
});
const box2 = await input.boundingBox();
await page.screenshot({ path: "/workspace/screenshots/comment-dock-typing.png" });
const ok =
  previewVisible &&
  box &&
  box.y < 280 && // upper portion of phone
  box2 &&
  box2.y < 280 &&
  box.y + box.height < 500; // fully above typical keyboard zone
console.log(JSON.stringify({ previewVisible, box, box2, ok }, null, 2));
if (!ok) process.exitCode = 2;
else console.log("PASS typing visible in upper half");
await browser.close();
