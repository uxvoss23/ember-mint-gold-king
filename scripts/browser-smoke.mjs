#!/usr/bin/env node
/**
 * Lightweight headless load + screenshot for http://127.0.0.1:8080 (or argv URL).
 * Does not try to "play" the app — just proves the page loads and captures a PNG
 * the agent can Read. Exit 0 on success, 1 on navigation failure, 2 if console errors.
 *
 * Screenshots default to ./screenshots under the project root (override with
 * SCREENSHOT_DIR). Targets are restricted (browser-guard.mjs).
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const root = process.env.APP_ROOT || process.cwd();
const shotDir = process.env.SCREENSHOT_DIR || join(root, "screenshots");
const url = checkedUrl(process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:8080/");
const outPng = checkedOutputPath(
  process.argv[3] || join(shotDir, "app-builder-preview.png"),
  [root],
);
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45000);
const ignoredConsole =
  /Failed to load resource|net::ERR|Overpass|AbortError|Download the React DevTools|favicon|MapLibre|WebGL/i;

mkdirSync(dirname(outPng), { recursive: true });

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));

  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const status = resp?.status() ?? 0;
  // Production maps (tiles, Overpass) never reach networkidle.
  await page.waitForLoadState("load", { timeout: timeoutMs }).catch(() => {});
  await page
    .waitForSelector("#uc-premium-boot", { state: "detached", timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  const title = await page.title();
  const hasCanvas = (await page.locator("canvas").count()) > 0;
  const bodyTextLen = (await page.locator("body").innerText().catch(() => "")).trim().length;

  await page.screenshot({ path: outPng, fullPage: false });

  console.log(
    JSON.stringify(
      {
        url,
        status,
        title,
        hasCanvas,
        bodyTextLen,
        consoleErrors,
        pageErrors,
        screenshot: outPng,
      },
      null,
      2,
    ),
  );

  if (status >= 400 || status === 0) process.exit(1);
  const realPageErrors = pageErrors.filter((e) => !ignoredConsole.test(e));
  const realConsole = consoleErrors.filter((e) => !ignoredConsole.test(e));
  if (realPageErrors.length || realConsole.length) process.exit(2);
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ ok: false, url, error: String(err?.message || err) }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
