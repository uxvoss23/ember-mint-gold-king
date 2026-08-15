import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);

// Seed live hooping check-ins
await page.evaluate(() => {
  const now = new Date().toISOString();
  const key = "court-social-v9";
  let raw = localStorage.getItem(key);
  let parsed = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch {}
  const state = parsed.state ?? parsed ?? {};
  const checkIns = [
    {
      id: "ci-test-butler",
      courtId: "cat-butler",
      courtName: "Butler Park Courts",
      author: "Kai T.",
      photoUrl: "/courts/placeholder.jpg",
      at: now,
      confirmedBy: ["Kai T."],
      chat: [],
    },
    {
      id: "ci-test-zilker",
      courtId: "cat-zilker",
      courtName: "Zilker Park Courts",
      author: "You",
      photoUrl: "/courts/placeholder.jpg",
      at: now,
      confirmedBy: ["You"],
      chat: [],
    },
  ];
  const next = { ...parsed, state: { ...state, checkIns } };
  localStorage.setItem(key, JSON.stringify(next));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3800);

// Open Courts tab
const courtsBtn = page.getByRole("button", { name: /courts/i }).first();
if (await courtsBtn.count()) await courtsBtn.click();
await page.waitForTimeout(1200);

// Dismiss any sheet overlay enough to see map - try Peek map
const peek = page.getByText(/peek map/i);
if (await peek.count()) await peek.first().click().catch(() => {});
await page.waitForTimeout(800);

await page.screenshot({ path: "/workspace/screenshots/lime-pins-map.png", fullPage: false });

const info = await page.evaluate(() => {
  const pins = [...document.querySelectorAll(".uc-pin")];
  const hoop = [...document.querySelectorAll(".uc-pin-hooping")];
  const faces = hoop.map((p) => {
    const face = p.querySelector(".uc-pin-face");
    if (!face) return null;
    const cs = getComputedStyle(face);
    return {
      bg: cs.backgroundColor,
      color: cs.color,
      classes: p.className,
    };
  });
  const orange = pins.filter((p) => !p.classList.contains("uc-pin-hooping")).map((p) => {
    const face = p.querySelector(".uc-pin-face");
    const cs = face ? getComputedStyle(face) : null;
    return cs?.backgroundColor ?? null;
  });
  const filterChip = document.body.innerText.includes("Hooping now");
  return {
    pinCount: pins.length,
    hoopCount: hoop.length,
    hoopFaces: faces,
    regularFaces: orange.slice(0, 4),
    filterChip,
    chatOpen: document.documentElement.getAttribute("data-uc-chat-open"),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
