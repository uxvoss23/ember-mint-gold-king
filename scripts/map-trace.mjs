#!/usr/bin/env node
import { chromium } from "playwright";

const URL = "http://127.0.0.1:8080/";
const throttle = process.argv.includes("--throttle");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844, deviceScaleFactor: 3 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
if (throttle) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 80,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (1 * 1024 * 1024) / 8,
  });
}

const logs = [];
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("[uc-map]") || t.includes("[MAP") || t.includes("map:")) logs.push(t);
});

const tNav = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

let last = null;
for (let i = 0; i < 60; i++) {
  last = await page.evaluate(() => {
    const pending = document.querySelector("[data-uc-map-pending]");
    const shown =
      !!pending &&
      !pending.hasAttribute("hidden") &&
      getComputedStyle(pending).display !== "none";
    const created = (window.__ucPerf || []).filter((r) => r.stage === "map:constructor").length;
    const pinLayers = (() => {
      try {
        const map = window.__ucWarmMap?.map;
        return map ? !!map.getLayer?.("uc-courts-pin") : false;
      } catch {
        return false;
      }
    })();
    const feat = (() => {
      try {
        const src = window.__ucWarmMap?.map?.getSource?.("uc-courts");
        return src?._data?.features?.length ?? src?._options?.data?.features?.length ?? -1;
      } catch {
        return -1;
      }
    })();
    return {
      canvas: document.querySelectorAll(".uc-map canvas").length,
      pending: shown,
      created,
      pinLayers,
      feat,
      perf: (window.__ucPerf || []).map((r) => ({ stage: r.stage, t: r.t })),
    };
  });
  if (last.canvas && last.pinLayers && last.feat > 0 && !last.pending) {
    console.log("usable after", Date.now() - tNav, "ms");
    break;
  }
  await page.waitForTimeout(100);
}
if (last) console.log(JSON.stringify(last, null, 2));
console.log("nav+", Date.now() - tNav, "ms throttle=", throttle);
console.log("\n=== console ===");
for (const l of logs) console.log(l);
await browser.close();
