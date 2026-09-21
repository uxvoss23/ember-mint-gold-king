import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("/workspace/artifacts", { recursive: true });

const BASE = "http://127.0.0.1:8080/";
const email = `ovw.${Date.now()}@upset.city`;
const pass = "overview99";

async function boot(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page
    .waitForSelector("#uc-premium-boot", { state: "detached", timeout: 15000 })
    .catch(() => {});
}

async function signup(page) {
  await page.goto(new URL("/login", BASE).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Create an account/i }).click();
  await page.getByPlaceholder("What should we call you?").waitFor({ timeout: 8000 });
  await page.getByPlaceholder("What should we call you?").fill("Overview Tester");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(pass);
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForTimeout(1500);
  const browse = page.getByRole("button", { name: /Browse Austin courts/i });
  if (await browse.count()) await browse.click();
  await page.waitForSelector('nav[aria-label="Main"]', { timeout: 20000 });
  const age = page.getByPlaceholder("24").first();
  if (await age.count()) {
    await age.fill("24");
    await page.getByPlaceholder("180").fill("180");
    const men = page.getByRole("button", { name: /^Men$/ });
    if (await men.count()) await men.click();
    const latino = page.getByRole("button", { name: /^Latino$/ });
    if (await latino.count()) await latino.click();
    await page.getByRole("button", { name: /Save and play/i }).click();
    await page.waitForTimeout(800);
  }
}

async function fillDetails(page) {
  const tip = page.getByRole("button", { name: /Tip-off/i }).first();
  if (await tip.count()) {
    const expanded = await tip.getAttribute("aria-expanded");
    if (expanded !== "true") await tip.click();
    await page.waitForTimeout(250);
  }
  const day = page.getByRole("button", { name: /Fri|Sat|Sun|Mon|Tue|Wed|Thu/i }).nth(4);
  if (await day.count()) await day.click();
  const timeBtn = page.getByRole("button", { name: /\d{1,2}:\d{2}\s*(AM|PM)/i }).nth(4);
  if (await timeBtn.count()) await timeBtn.click();
  const yes = page.getByRole("button", { name: /^Yes$/ }).first();
  if (await yes.count()) await yes.click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /^Continue$/ }).first().click({ force: true });
  await page.waitForTimeout(700);
}

async function toOverviewFromCourt(page) {
  const card = page.locator(".uc-map-carousel-card").first();
  if (await card.count()) await card.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const cont = page.getByRole("button", { name: /^Continue$/ }).first();
  if (await cont.count()) await cont.click({ force: true });
  await page
    .getByText("You’re playing")
    .waitFor({ timeout: 8000 })
    .catch(() => {});
}

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await boot(page);
await signup(page);

// COURTS FLOW first (tabs visible)
await page.getByRole("button", { name: "Courts" }).click({ force: true });
await page.waitForTimeout(1000);
const viewDetails = page.getByRole("button", { name: /View details/i }).first();
if (await viewDetails.count()) await viewDetails.click();
await page.waitForTimeout(600);
const playHere = page.getByRole("button", { name: /Play here/i }).first();
if (await playHere.count()) {
  await playHere.click();
} else {
  const playChip = page.getByRole("button", { name: /^Play$/ }).first();
  if (await playChip.count()) await playChip.click();
}
await page.getByRole("heading", { name: /Create 1v1/i }).first().waitFor({ timeout: 10000 });
await fillDetails(page);
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/artifacts/overview-courts.png" });

// PLAY FLOW — new create from Play (exit current)
while (await page.getByRole("button", { name: /← Back|← Explore/i }).count()) {
  await page.getByRole("button", { name: /← Back|← Explore/i }).first().click({ force: true });
  await page.waitForTimeout(350);
  if (await page.getByRole("button", { name: /Create a game|Create game/i }).count()) break;
}
await page.waitForTimeout(500);
if (!(await page.getByRole("button", { name: /Create a game|Create game/i }).count())) {
  await page.getByRole("button", { name: "Play" }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
}
await page.getByRole("button", { name: /Create a game|Create game/i }).first().click({ force: true });
await page.getByRole("heading", { name: /Create 1v1/i }).first().waitFor({ timeout: 8000 });
await fillDetails(page);
await toOverviewFromCourt(page);
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/artifacts/overview-play.png" });

const dump = {
  courtsPlaying: await page.getByText("You’re playing").count(),
  courtsHero: await page.getByRole("button", { name: /Change court/i }).count(),
  playCta: await page.getByRole("button", { name: /Create Game|Post public match/i }).count(),
  bodySnippet: (await page.locator("body").innerText()).slice(0, 500),
};
console.log(JSON.stringify(dump, null, 2));
await browser.close();
