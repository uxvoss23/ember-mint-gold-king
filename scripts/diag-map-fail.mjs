import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080/";
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  geolocation: { latitude: 30.2672, longitude: -97.7431 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message}`));
page.on("requestfailed", (r) => {
  const u = r.url();
  if (/maplibre|arcgis|tile|worker/i.test(u)) logs.push(`REQFAIL: ${u} ${r.failure()?.errorText}`);
});

const t0 = Date.now();
await page.goto(BASE + "?diag=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(3500);

const dump = await page.evaluate(() => {
  const overlay = [...document.querySelectorAll("p")].find((p) => p.textContent?.includes("Loading map"));
  const overlayVis = overlay ? getComputedStyle(overlay.parentElement).display : "none";
  const mapEl = document.querySelector(".uc-map");
  const canvas = document.querySelector(".uc-map canvas, #uc-map-lot canvas");
  const lot = document.getElementById("uc-map-lot");
  const w = window;
  const map = w.__ucWarmMap?.map || null;
  let pinCount = 0, srcCount = 0, layers = [], err = null;
  try {
    if (map) {
      layers = map.getStyle()?.layers?.map((l) => l.id) ?? [];
      if (map.getLayer("uc-courts-pin")) {
        pinCount = map.queryRenderedFeatures({ layers: ["uc-courts-pin"] }).length;
      }
      srcCount = map.querySourceFeatures?.("uc-courts")?.length ?? 0;
    }
  } catch (e) {
    err = String(e);
  }
  return {
    overlayText: overlay?.textContent ?? null,
    overlayVis,
    overlayParentHidden: overlay?.parentElement?.hasAttribute("hidden") ?? null,
    mapBox: mapEl ? mapEl.getBoundingClientRect() : null,
    canvasParent: canvas?.parentElement?.id || canvas?.parentElement?.className || null,
    canvasSize: canvas ? { w: canvas.width, h: canvas.height, cw: canvas.clientWidth, ch: canvas.clientHeight } : null,
    lotHasCanvas: !!lot?.querySelector("canvas"),
    lotKids: lot?.childElementCount ?? 0,
    hasWarm: !!w.__ucWarmMap?.map,
    mapBoot: !!w.__ucMapBoot,
    constructors: (w.__ucPerf || []).filter((x) => String(x.stage).includes("constructor") || String(x.stage).includes("adopt") || String(x.stage).includes("init")),
    perf: (w.__ucPerf || []).slice(0, 40),
    pinCount,
    srcCount,
    layers: layers.filter((id) => /court|pin|carto/i.test(id)),
    htmlPins: document.querySelectorAll(".uc-pin").length,
    err,
    loadingCount: [...document.querySelectorAll("p")].filter((p) => p.textContent?.includes("Loading map")).length,
  };
});

await page.screenshot({ path: "/workspace/artifacts/diag-map-fail.png" });
console.log(JSON.stringify({ ms: Date.now() - t0, dump, logs: logs.slice(0, 80) }, null, 2));
await browser.close();
