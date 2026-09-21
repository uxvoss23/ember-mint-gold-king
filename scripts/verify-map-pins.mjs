import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080/";
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 30.2672, longitude: -97.7431 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const t0 = Date.now();
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForFunction(
  () => !!document.querySelector(".uc-map canvas") || !!document.querySelector('nav[aria-label="Main"]'),
  { timeout: 20000 },
).catch(() => {});

const courtsBtn = page.locator('nav[aria-label="Main"] button', { hasText: "Courts" }).first();
if (await courtsBtn.count()) {
  await courtsBtn.click({ timeout: 5000 }).catch(() => {});
}

await page.waitForSelector(".uc-map canvas", { timeout: 15000 }).catch(() => {});

await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/artifacts/courts-map-1s.png" });
await page.waitForTimeout(2000);


const dump = await page.evaluate(() => {
  const w = window;
  const map = w.__ucWarmMap?.map || null;
  let pinCount = 0;
  let srcCount = 0;
  let layers = [];
  let styleLoaded = false;
  let loaded = false;
  if (map) {
    try {
      styleLoaded = map.isStyleLoaded?.() ?? false;
      loaded = map.loaded?.() ?? false;
      layers = map.getStyle()?.layers?.map((l) => l.id) ?? [];
      const src = map.getSource("uc-courts");
      srcCount = src?._data?.features?.length ?? src?._options?.data?.features?.length ?? 0;
      if (typeof map.querySourceFeatures === "function") {
        try {
          srcCount = Math.max(srcCount, map.querySourceFeatures("uc-courts").length);
        } catch {}
      }
      if (map.getLayer("uc-courts-pin")) {
        pinCount = map.queryRenderedFeatures({ layers: ["uc-courts-pin"] }).length;
      }
    } catch (e) {
      return { err: String(e), hasMap: !!map };
    }
  }
  return {
    hasCanvas: !!document.querySelector(".uc-map canvas"),
    overlay: !!document.querySelector("[data-uc-map-pending]:not([hidden])"),
    boot: !!document.getElementById("uc-premium-boot"),
    htmlPins: document.querySelectorAll(".uc-pin").length,
    you: document.querySelectorAll(".uc-you, .uc-you-wrap").length,
    carousel: document.querySelectorAll(".uc-map-carousel-card").length,
    hasMap: !!map,
    styleLoaded,
    loaded,
    pinCount,
    srcCount,
    hasPinLayer: layers.includes("uc-courts-pin"),
    hasSource: layers.length ? true : false,
    layers: layers.filter((id) => id.includes("court") || id.includes("pin")),
    textSample: document.body.innerText.slice(0, 400),
  };
});

await page.screenshot({ path: "/workspace/artifacts/courts-map-pins.png", fullPage: false });
console.log(JSON.stringify({ ms: Date.now() - t0, dump, errors: errors.slice(0, 12) }, null, 2));
await browser.close();
