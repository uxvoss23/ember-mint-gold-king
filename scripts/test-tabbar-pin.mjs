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
await page.waitForTimeout(3000);

const measure = () => page.evaluate(() => {
  const shell = document.querySelector(".app-shell");
  const nav = document.getElementById("uc-bottom-tab-bar");
  const sr = shell.getBoundingClientRect();
  const nr = nav.getBoundingClientRect();
  const pill = nav.firstElementChild?.getBoundingClientRect();
  return {
    shellBottom: sr.bottom,
    navBottom: nr.bottom,
    pillBottom: pill?.bottom,
    innerH: window.innerHeight,
    gapShell: window.innerHeight - sr.bottom,
    gapNav: window.innerHeight - nr.bottom,
    gapPill: pill ? window.innerHeight - pill.bottom : null,
    navPos: getComputedStyle(nav).position,
    shellH: sr.height,
  };
});

console.log("LOAD", await measure());

// Simulate stuck visual-viewport shrink that used to create the black band
await page.evaluate(() => {
  const shell = document.querySelector(".app-shell");
  // Evil: pretend old keyboard code shrank the shell
  shell.style.height = "650px";
  shell.style.bottom = "auto";
  shell.style.top = "0px";
});
await page.waitForTimeout(100);
console.log("AFTER_SHRINK_ATTACK", await measure());

// Trigger ViewportLock via resize
await page.evaluate(() => window.dispatchEvent(new Event("resize")));
await page.waitForTimeout(100);
const healed = await measure();
console.log("AFTER_RESIZE_HEAL", healed);

await page.screenshot({ path: "/workspace/screenshots/tabbar-healed.png" });

if (healed.gapNav > 2 || healed.gapShell > 2) {
  console.error("FAIL still gapped after heal");
  process.exit(2);
}
if (healed.navPos !== "static") {
  console.error("FAIL nav should be in-flow static, got", healed.navPos);
  process.exit(2);
}
if ((healed.gapPill ?? 99) > 30) {
  console.error("FAIL pill too high", healed.gapPill);
  process.exit(2);
}
console.log("PASS: in-flow tabs; shell fills viewport; recovers from shrink attack");
await browser.close();
