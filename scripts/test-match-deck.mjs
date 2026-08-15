#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

const play = page.getByRole("button", { name: /^Play$/i }).first();
await play.click();
await page.waitForTimeout(600);

const matchTile = page.getByRole("button", { name: /Match Mode/i }).first();
await matchTile.click();
await page.waitForTimeout(800);

// Soft wizard if present
for (const label of ["Next · time of day", "Next · travel", "Start matching"]) {
  const btn = page.getByRole("button", { name: label });
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(350);
  }
}

await page.screenshot({
  path: "/workspace/screenshots/mm-deck-fixed.png",
  fullPage: false,
});

const info = await page.evaluate(() => {
  const header = [...document.querySelectorAll("p")].find((p) =>
    /Match Mode/.test(p.textContent || ""),
  );
  const nearby = [...document.querySelectorAll("p")].find((p) =>
    /nearby/.test(p.textContent || ""),
  );
  const names = [...document.querySelectorAll("p")].filter((p) =>
    /Andre|Kai|Marcus|Jia|Devon|Noah|Sean|Riley|Tess|Cam|Sam/.test(
      p.textContent || "",
    ),
  );
  const card = document.querySelector(
    ".rounded-3xl.border.border-border.bg-bg-elevated",
  );
  const r = card?.getBoundingClientRect();
  const like = document.querySelector('[aria-label="Like"]');
  return {
    header: header?.textContent ?? null,
    nearby: nearby?.textContent ?? null,
    names: names.slice(0, 4).map((n) => n.textContent),
    cardH: r ? Math.round(r.height) : 0,
    cardW: r ? Math.round(r.width) : 0,
    hasLike: !!like,
    bodyText: document.body.innerText.slice(0, 400),
  };
});

console.log(JSON.stringify({ info, errors }, null, 2));
await browser.close();

if (info.cardH < 180 || info.names.length === 0) {
  console.error("FAIL: deck card not visible");
  process.exit(1);
}
console.log("PASS");
