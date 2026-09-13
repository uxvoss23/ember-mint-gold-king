#!/usr/bin/env node
/**
 * Map-load stage timings + main-thread / tap lag.
 * Usage: node scripts/measure-map-load.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080/";

async function measure(label, { cpu = 1 } = {}) {
  const browser = await chromium.launch({
    args: ["--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 30.2672, longitude: -97.7431 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const w = window;
    w.__ucLong = [];
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          w.__ucLong.push({
            name: e.name,
            start: Math.round(e.startTime),
            dur: Math.round(e.duration),
          });
        }
      });
      po.observe({ type: "longtask", buffered: true });
    } catch {
      /* unsupported */
    }
  });
  if (cpu > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  }

  const wall0 = Date.now();
  const times = {};
  const mark = async (key, pred, timeout = 15000) => {
    try {
      await page.waitForFunction(pred, { timeout });
      times[key] = Date.now() - wall0;
    } catch {
      times[key] = `timeout@${Date.now() - wall0}`;
    }
  };

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  times.dcl = Date.now() - wall0;

  await mark("mapEl", () => !!document.querySelector(".uc-map"));
  await mark("canvas", () => !!document.querySelector(".uc-map canvas"));
  await mark("bootGoneVis", () => {
    const el = document.getElementById("uc-premium-boot");
    if (!el) return true;
    return el.classList.contains("uc-boot-out");
  });
  await mark("overlayGone", () => {
    const el = document.querySelector("[data-uc-map-pending]");
    if (!el) return true;
    const st = getComputedStyle(el);
    return st.display === "none" || el.hasAttribute("hidden");
  });
  await mark("bootUnmounted", () => !document.getElementById("uc-premium-boot"));
  await mark("pin", () => !!document.querySelector(".uc-pin, .uc-cluster, .uc-you"));
  await mark("tabs", () => !!document.querySelector('nav[aria-label="Main"]'));

  let tapDelay = null;
  try {
    const play = page.locator("nav[aria-label='Main'] button", { hasText: "Play" }).first();
    await play.waitFor({ state: "visible", timeout: 8000 });
    const tTap = Date.now();
    await play.click({ timeout: 5000 });
    tapDelay = Date.now() - tTap;
    times.playClickMs = tapDelay;
    await page
      .waitForFunction(
        () =>
          document.body.innerText.includes("Opening Play") ||
          document.body.innerText.includes("Hoop now") ||
          document.body.innerText.includes("Create") ||
          document.querySelector("[data-uc-create-immersive], [data-uc-play]"),
        { timeout: 6000 },
      )
      .catch(() => {});
    times.playView = Date.now() - wall0;
    await page.locator("nav[aria-label='Main'] button", { hasText: "Courts" }).first().click({ timeout: 5000 });
  } catch (e) {
    times.playErr = e.message?.slice(0, 120);
  }

  await page.waitForTimeout(800);

  const dump = await page.evaluate(() => {
    const w = window;
    const perf = w.__ucPerf || [];
    const t0 = perf[0]?.t ?? 0;
    const marks = perf.map((r) => ({ stage: r.stage, at: r.t, dt: r.t - t0 }));
    const long = w.__ucLong || [];
    const res = performance
      .getEntriesByType("resource")
      .filter((e) =>
        /maplibre|preload-maplibre|arcgisonline|World_Street/i.test(e.name),
      )
      .map((e) => ({
        name: e.name.replace(/^https?:\/\/[^/]+/, "").slice(0, 100),
        start: Math.round(e.startTime),
        dur: Math.round(e.duration),
        size: e.transferSize,
      }));
    const nav = performance.getEntriesByType("navigation")[0];
    const inits = marks.filter((m) => String(m.stage).startsWith("map:init-start"));
    const adopts = marks.filter((m) => m.stage === "map:adopt");
    return {
      marks,
      long,
      longSum: long.reduce((s, x) => s + x.dur, 0),
      longMax: long.reduce((m, x) => Math.max(m, x.dur), 0),
      res,
      inits: inits.length,
      initStages: inits.map((i) => i.stage),
      adopts: adopts.length,
      overlay: !!document.querySelector("[data-uc-map-pending]:not([hidden])"),
      pins: document.querySelectorAll(".uc-pin").length,
      you: document.querySelectorAll(".uc-you").length,
      boot: !!document.getElementById("uc-premium-boot"),
      hasCanvas: !!document.querySelector(".uc-map canvas"),
      nav: nav
        ? {
            dcl: Math.round(nav.domContentLoadedEventEnd),
            load: Math.round(nav.loadEventEnd),
            response: Math.round(nav.responseEnd),
            domInteractive: Math.round(nav.domInteractive),
          }
        : null,
    };
  });

  await browser.close();
  return { label, cpu, wall: times, dump, tapDelay };
}

function print(r) {
  console.log("\n========", r.label, "cpu=" + r.cpu, "========");
  console.log("WALL", r.wall);
  console.log("tapDelay", r.tapDelay);
  console.log("inits", r.dump.inits, r.dump.initStages, "adopts", r.dump.adopts);
  console.log(
    "overlay",
    r.dump.overlay,
    "pins",
    r.dump.pins,
    "you",
    r.dump.you,
    "canvas",
    r.dump.hasCanvas,
  );
  console.log("nav", r.dump.nav);
  console.log("longSum", r.dump.longSum, "longMax", r.dump.longMax, "n", r.dump.long.length);
  console.log(
    "long tasks",
    r.dump.long
      .slice()
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 8),
  );
  console.log("marks", r.dump.marks);
  console.log("res", r.dump.res);
}

const a = await measure("cold", { cpu: 1 });
print(a);
const b = await measure("repeat", { cpu: 1 });
print(b);
const c = await measure("cpu4", { cpu: 4 });
print(c);
