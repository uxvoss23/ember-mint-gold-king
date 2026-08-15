import { chromium } from "playwright";
import fs from "fs";
fs.mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const path = (el) => {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && parts.length < 8) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += "#" + n.id;
      if (n.className && typeof n.className === "string") s += "." + n.className.split(/\s+/).slice(0,3).join(".");
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(" > ");
  };
  const all = [...document.querySelectorAll("body *")].filter(el => {
    const r = el.getBoundingClientRect();
    return r.height > 50 && r.width > 100;
  }).slice(0, 40).map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      path: path(el).slice(-120),
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      pos: cs.position, overflow: cs.overflow, z: cs.zIndex,
    };
  });
  return {
    innerH: window.innerHeight,
    bodyH: document.body.getBoundingClientRect().height,
    docH: document.documentElement.getBoundingClientRect().height,
    scrollY: window.scrollY,
    vv: window.visualViewport && { h: window.visualViewport.height, off: window.visualViewport.offsetTop },
    header: document.querySelector("header")?.getBoundingClientRect(),
    shell: document.querySelector(".app-shell")?.getBoundingClientRect(),
    nav: document.getElementById("uc-bottom-tab-bar")?.getBoundingClientRect(),
    big: all,
  };
});
console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: "/workspace/screenshots/debug-full.png" });
await browser.close();
