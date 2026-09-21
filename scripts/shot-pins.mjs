import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 30.2672, longitude: -97.7431 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:8080/?p=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector(".uc-map canvas", { timeout: 15000 });
await page.waitForTimeout(2000);

await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".uc-map-carousel-card")];
  const el = cards.find((c) => c.textContent?.includes("Battle Bend"));
  el?.scrollIntoView({ inline: "center", block: "nearest" });
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/artifacts/pins-circular.png" });

const dump = await page.evaluate(() => {
  const map = window.__ucWarmMap?.map;
  const images = map ? [map.hasImage("uc-pin-idle-v14-circle"), map.hasImage("uc-pin-sel-v14-circle"), map.hasImage("uc-pin-idle-v13")] : [];
  const pinCount = map?.getLayer("uc-courts-pin")
    ? map.queryRenderedFeatures({ layers: ["uc-courts-pin"] }).length
    : 0;
  const pill = document.querySelector(".uc-map-name-pill-text")?.textContent;
  return { images, pinCount, pill, constructors: (window.__ucPerf || []).filter(x => String(x.stage).includes("constructor")).length };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
