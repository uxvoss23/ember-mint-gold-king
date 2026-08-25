import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
// dismiss any auth/onboarding if present
const courtsBtn = page.getByRole("button", { name: /nearby courts|courts/i }).first();
if (await courtsBtn.count()) {
  try { await courtsBtn.click({ timeout: 2000 }); } catch { /* ignore */ }
}
await page.waitForTimeout(1800);
await page.screenshot({ path: "/workspace/screenshots/world-map-mobile.png", fullPage: false });
const cta = page.getByRole("button", { name: /check in|head to|find courts/i }).first();
const ctaText = await cta.textContent().catch(() => null);
if (await cta.count()) {
  await cta.click();
  await page.waitForTimeout(800);
}
await page.screenshot({ path: "/workspace/screenshots/world-map-cta.png", fullPage: false });
console.log(JSON.stringify({ ctaText, errors, title: await page.title() }, null, 2));
await browser.close();
