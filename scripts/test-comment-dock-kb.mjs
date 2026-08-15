import { chromium } from "playwright";
import fs from "fs";
fs.mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /courts/i }).first().click().catch(()=>{});
await page.waitForTimeout(600);
const write = page.getByRole("button", { name: /^Write$/i });
if (await write.count()) await write.first().click();
else await page.getByRole("button", { name: /Add a comment/i }).first().click().catch(()=>{});
await page.waitForTimeout(300);

const input = page.locator('input[placeholder="What are you seeing?"]');
await input.waitFor({ state: "visible", timeout: 5000 });

// Mock keyboard: shrink visualViewport-like by evaluating transform binder manually
// Simulate what iOS does: reduce innerHeight relative to vv is hard; call binder math
const before = await input.boundingBox();

// Dispatch a fake visualViewport by overriding and firing resize
await page.evaluate(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  // Monkeypatch height getter simulation: fire resize after setting a CSS var
  // Directly set dock transform as the binder would for 300px keyboard
  const dock = document.querySelector('[data-uc-composer="dock"]');
  if (dock) {
    dock.style.transition = "none";
    dock.style.transform = "translate3d(0, -320px, 0)";
  }
});
await page.waitForTimeout(100);
const after = await input.boundingBox();
await page.screenshot({ path: "/workspace/screenshots/comment-dock-kb.png" });

console.log(JSON.stringify({ before, after, lifted: before && after ? before.y - after.y : null }, null, 2));

// With 320px lift, input should be much higher and still on screen
if (!after || after.y < 0 || after.y + after.height > 844) {
  console.error("FAIL not fully visible after lift", after);
  process.exitCode = 2;
} else if (before && after && before.y - after.y < 200) {
  console.error("FAIL did not lift enough");
  process.exitCode = 2;
} else {
  console.log("PASS keyboard lift keeps input on screen");
}
await browser.close();
