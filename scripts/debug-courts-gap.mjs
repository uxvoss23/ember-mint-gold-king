import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /nearby courts|Courts/i }).first().click();
await page.waitForTimeout(1200);

const m = await page.evaluate(() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1),
      flex: cs.flex, flexGrow: cs.flexGrow, minH: cs.minHeight, hCss: cs.height,
      display: cs.display, overflow: cs.overflow,
      cls: (el.className||"").toString().slice(0, 90),
    };
  };
  const shell = document.querySelector(".app-shell");
  const header = shell?.querySelector("header");
  const main = shell?.querySelector("main");
  const scene = main?.firstElementChild;
  const scroll = scene?.querySelector("[data-app-scroll]");
  const courts = scroll?.firstElementChild;
  const sheet = [...document.querySelectorAll("div")].find(d =>
    (d.className||"").includes("rounded-t-3xl") && (d.className||"").includes("bottom-0"));
  const nav = document.getElementById("uc-bottom-tab-bar");

  return {
    innerH: window.innerHeight,
    shell: rect(shell),
    header: rect(header),
    main: rect(main),
    scene: rect(scene),
    scroll: rect(scroll),
    courts: rect(courts),
    sheet: rect(sheet),
    nav: rect(nav),
    gaps: {
      courtsToNav: courts && nav ? +(nav.getBoundingClientRect().top - courts.getBoundingClientRect().bottom).toFixed(1) : null,
      sheetToNav: sheet && nav ? +(nav.getBoundingClientRect().top - sheet.getBoundingClientRect().bottom).toFixed(1) : null,
      scrollToNav: scroll && nav ? +(nav.getBoundingClientRect().top - scroll.getBoundingClientRect().bottom).toFixed(1) : null,
    },
  };
});
console.log(JSON.stringify(m, null, 2));
await browser.close();
