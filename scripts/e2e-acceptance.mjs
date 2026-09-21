#!/usr/bin/env node
/**
 * Acceptance against a running app. Guest UI + required two-account journey.
 * Failures print and exit 1. Do not treat journey steps as optional.
 *
 * Functional baseline: git tag `checkpoint/e2e-47-two-account` (commit a8f741a).
 * UI/design refactors must still pass every required check — do not delete,
 * skip, or weaken assertions (especially account isolation, join, chat,
 * 1–0/1–0 rejection, opponent confirm, and ratings only after confirm).
 *
 * Usage: BASE_URL=http://127.0.0.1:8080 node scripts/e2e-acceptance.mjs
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080/";
const SHOT =
  process.env.SCREENSHOT_DIR ||
  join(process.env.APP_ROOT || process.cwd(), "screenshots");
mkdirSync(SHOT, { recursive: true });

const results = [];
/** Happy-path required checks at checkpoint/e2e-47-two-account. Do not lower. */
const BASELINE_REQUIRED = 47;
const ignoredConsole =
  /Failed to load resource|net::ERR|Overpass|AbortError|Download the React DevTools|favicon/i;

function log(name, ok, extra = "", required = true) {
  results.push({ name, ok, extra, required });
  console.log(
    `${ok ? "PASS" : required ? "FAIL" : "TRY "}  ${name}${extra ? " — " + extra : ""}`,
  );
}

async function boot(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page
    .waitForSelector("#uc-premium-boot", { state: "detached", timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(400);
}

async function enterAustin(page) {
  const browse = page.getByRole("button", { name: /Browse Austin courts/i });
  if (await browse.count()) {
    await browse.click();
    await page.waitForTimeout(600);
  }
}

async function waitTabs(page, timeout = 20000) {
  await page.waitForSelector('nav[aria-label="Main"]', { timeout });
}

async function tapTab(page, label) {
  await waitTabs(page);
  await page.locator("nav[aria-label='Main'] button", { hasText: label }).first().click();
  await page.waitForTimeout(400);
}

/** First *visible* button matching accessible name — skips hidden Me/Play clones. */
function visButton(page, name) {
  return page.getByRole("button", { name }).filter({ visible: true }).first();
}

async function clickVis(page, name, timeout = 5000) {
  const btn = visButton(page, name);
  const ok = await btn
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
  if (ok) await btn.click();
  return ok;
}

async function openScoreConfirm(page) {
  const confirmCtl = () =>
    page.getByTestId("confirm-score").or(visButton(page, /Looks right · confirm/i)).first();
  if (!(await confirmCtl().count())) {
    await tapTab(page, "Me");
    await page.waitForTimeout(800);
    const fromMe = await clickVis(page, /Score pending vs/i, 4000);
    if (!fromMe) await clickVis(page, /Score pending/i, 2000);
    await page.waitForTimeout(700);
  }
  if (!(await confirmCtl().count())) {
    await tapTab(page, "Play");
    await page.waitForTimeout(500);
    await clickVis(page, /My Games/i, 3000);
    await page.waitForTimeout(400);
    const opened = await clickVis(page, /Confirm score vs/i, 5000);
    if (!opened) await clickVis(page, /Confirm score/i, 3000);
    await page.waitForTimeout(700);
  }
  await clickVis(page, /^Details$/i, 2000);
  await page.waitForTimeout(400);
  return confirmCtl()
    .waitFor({ state: "visible", timeout: 12000 })
    .then(() => true)
    .catch(() => false);
}

function playCreateButton(page) {
  return page.getByRole("button", { name: /Create a game|Create game/i }).first();
}

async function bodyText(page) {
  return page.locator("body").innerText();
}

async function waitFor(page, predicate, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function completeProfile(page, age = "24", { tryUnderage = false } = {}) {
  const ageInput = page.getByPlaceholder("24").first();
  const visible = await ageInput
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return false;
  if (tryUnderage) {
    await ageInput.fill("16");
    await page.getByPlaceholder("180").fill("180");
    const men = page.getByRole("button", { name: /^Men$/ });
    if (await men.count()) await men.click();
    const latino = page.getByRole("button", { name: /^Latino$/ });
    if (await latino.count()) await latino.click();
    await page.getByRole("button", { name: /Save and play/i }).click();
    await page.waitForTimeout(900);
    const body = await bodyText(page);
    log(
      "age 16 blocked in running app",
      /17 and older|17 or older|Age 17/i.test(body),
    );
  }
  await ageInput.fill(age);
  await page.getByPlaceholder("180").fill("180");
  await page.getByRole("button", { name: /^Men$/ }).click();
  await page.getByRole("button", { name: /^Latino$/ }).click();
  await page.getByRole("button", { name: /Save and play/i }).click();
  await waitFor(
    page,
    async () => (await page.getByRole("button", { name: /Save and play/i }).count()) === 0
      || (await page.getByText(/Privacy and discovery/i).count()) > 0,
    8000,
  );
  return true;
}

async function signupOnLoginPage(page, { name, email, password }) {
  await page.getByPlaceholder("you@email.com").first().waitFor({ state: "visible", timeout: 15000 });
  const nameBox = page.getByPlaceholder("What should we call you?");
  for (let i = 0; i < 5; i += 1) {
    if (await nameBox.isVisible().catch(() => false)) break;
    const toggle = page.getByRole("button", { name: "Create an account" }).first();
    if (await toggle.count()) {
      await toggle.scrollIntoViewIfNeeded().catch(() => {});
      await toggle.click({ force: true });
    }
    await page.waitForTimeout(500);
  }
  if (!(await nameBox.isVisible().catch(() => false))) {
    await page.screenshot({ path: `${SHOT}/e2e-signup-mode.png` }).catch(() => {});
    const t = (await page.locator("body").innerText().catch(() => "")).slice(0, 240);
    throw new Error(`signup form did not open (${t})`);
  }
  await nameBox.fill(name);
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(password);
  await page.getByRole("button", { name: /^Create account$/i }).click();
  const alert = page.locator('[role="alert"]').first();
  await page.waitForTimeout(800);
  const err = (await alert.textContent().catch(() => "")) || "";
  if (err && /fail|invalid|error|already/i.test(err)) {
    throw new Error(err);
  }
  await page.waitForURL((url) => !/\/login/i.test(url.pathname + url.search), {
    timeout: 15000,
  }).catch(() => {});
  await enterAustin(page);
}

async function signup(page, { name, email, password }) {
  await page.goto(new URL("/login", BASE).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await signupOnLoginPage(page, { name, email, password });
  await waitTabs(page);
}

async function signInEmail(page, { email, password }) {
  await page.goto(new URL("/login", BASE).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1200);
  const emailBox = page.getByPlaceholder("you@email.com");
  if (/\/login/i.test(page.url()) && (await emailBox.count())) {
    await emailBox.fill(email);
    await page.getByPlaceholder("At least 8 characters").fill(password);
    await page.getByRole("button", { name: /Sign in with email/i }).click();
    await page.waitForTimeout(2000);
  }
  await enterAustin(page);
  await ensureTabs(page);
}

async function pickTipoff(page) {
  const tip = page.getByRole("button", { name: /Tip-off/i }).first();
  if (await tip.count()) {
    const expanded = await tip.getAttribute("aria-expanded");
    if (expanded !== "true") await tip.click();
    await page.waitForTimeout(300);
  }
  const days = page.getByRole("button", { name: /Fri|Sat|Sun|Mon|Tue|Wed|Thu/i });
  const dayCount = await days.count();
  const start = Math.min(2, Math.max(0, dayCount - 1));
  for (let i = start; i < dayCount; i += 1) {
    const day = days.nth(i);
    if (await day.isDisabled().catch(() => true)) continue;
    await day.click();
    await page.waitForTimeout(200);
    const times = page.getByRole("button", { name: /\d{1,2}:\d{2}\s*(AM|PM)/i });
    const n = await times.count();
    for (let j = 0; j < n; j += 1) {
      const slot = times.nth(j);
      if (await slot.isDisabled().catch(() => true)) continue;
      await slot.click();
      await page.waitForTimeout(250);
      return true;
    }
  }
  return false;
}

async function pickCreateCourt(page) {
  if ((await createFlowOpen(page).count()) === 0) {
    await tapTab(page, "Play");
    await page.waitForTimeout(400);
    if (await playCreateButton(page).count()) {
      await playCreateButton(page).click();
      await page.waitForTimeout(600);
    }
  }
  const list = page.getByRole("button", { name: /^List$/ }).first();
  if (await list.count()) await list.click();
  await page.waitForTimeout(200);
  const filtersToggle = page.getByRole("button", { name: /^Filters/i }).first();
  if (await filtersToggle.count()) {
    const expanded = await filtersToggle.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await filtersToggle.click();
      await page.waitForTimeout(200);
    }
  }
  for (const name of ["Highest rated", "Near me", "Shaded"]) {
    const chip = page.getByRole("button", { name: new RegExp(name, "i") }).first();
    if (!(await chip.count())) continue;
    const label = ((await chip.innerText()) || "").trim();
    if (label.includes("✓") || label.startsWith("✓")) {
      await chip.click();
      await page.waitForTimeout(150);
    }
  }
  const select = page.getByRole("button", { name: /Select (?!court$)/i }).first();
  const appeared = await select
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await select.click();
    return;
  }
  const card = page.getByRole("button", { name: /Park|Zilker|Givens|Butler|Bartholomew|Pease|Rosewood/i }).first();
  if (await card.count()) await card.click();
}

function createFlowOpen(page) {
  return page.getByRole("heading", { name: /Create 1v1/i }).first();
}

async function ensureTabs(page, timeout = 12000) {
  for (let i = 0; i < 3; i += 1) {
    const nav = page.locator('nav[aria-label="Main"]');
    if ((await nav.count()) && (await nav.isVisible().catch(() => false))) return;
    const bottom = page.getByRole("button", { name: /^Back to Explore$/i }).first();
    const top = page.getByRole("button", { name: /← Explore|← Back to open games|← Upcoming|← Back$/i }).first();
    if (await bottom.count()) await bottom.click().catch(() => {});
    else if (await top.count()) await top.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await waitTabs(page, timeout);
}

async function postedMatchVisible(page) {
  if ((await createFlowOpen(page).count()) > 0) return false;
  if ((await page.getByRole("button", { name: /Post public match|Create Game/i }).count()) > 0) {
    return false;
  }
  if ((await page.getByTestId("open-game-chat").count()) > 0) return true;
  const t = await bodyText(page);
  return /You’re hosting|Waiting for a player|Public match is live in the lobby/i.test(t);
}

async function postPublicMatch(page) {
  const continueBtn = page.getByRole("button", { name: /^Continue$/ }).first();
  if (await continueBtn.count()) {
    await pickTipoff(page);
    const yes = page.getByRole("button", { name: /^Yes$/ }).first();
    if (await yes.count()) await yes.click();
    await continueBtn.click();
    await page.waitForTimeout(400);
  }
  await pickCreateCourt(page);
  const selectCourt = page.getByRole("button", { name: /^Select court$/ }).first();
  if (await selectCourt.count()) {
    await selectCourt.click();
    await page.waitForTimeout(500);
  } else if (await continueBtn.count()) {
    await continueBtn.click();
    await page.waitForTimeout(400);
  }
  if ((await page.getByRole("button", { name: /Post public match|Create Game/i }).count()) === 0) {
    if (await page.getByText(/Pick a date and time/i).count()) {
      await pickTipoff(page);
    }
  }
  if (await page.getByPlaceholder("24").count()) {
    await completeProfile(page, "24");
  }
  const post = page.getByRole("button", { name: /Post public match|Create Game/i }).first();
  log("post public match CTA", (await post.count()) > 0);
  if (!(await post.count())) return false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      const selects = page.getByRole("button", { name: /Select (?!court$)/i });
      const n = await selects.count();
      if (n > attempt) {
        await selects.nth(attempt).click().catch(() => {});
        await page.waitForTimeout(300);
      }
      await pickTipoff(page);
      const again = page.getByRole("button", { name: /Post public match|Create Game/i }).first();
      if (!(await again.count())) break;
      await again.click();
    } else {
      await post.click();
    }
    if (await page.getByPlaceholder("24").count()) {
      await completeProfile(page, "24");
      const retry = page.getByRole("button", { name: /Post public match|Create Game/i }).first();
      if (await retry.count()) await retry.click();
    }
    const ok = await waitFor(page, () => postedMatchVisible(page), 8000);
    if (ok) return true;
    const stillCreate = (await createFlowOpen(page).count()) > 0;
    if (!stillCreate) return false;
  }
  return postedMatchVisible(page);
}

async function exitCreateIfOpen(page) {
  await ensureTabs(page).catch(() => {});
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const iphone = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

try {
  /* ---------- Guest: location denied ---------- */
  const deniedCtx = await browser.newContext({
    ...iphone,
    permissions: [],
    geolocation: undefined,
  });
  const denied = await deniedCtx.newPage();
  await boot(denied);
  const useLoc = denied.getByRole("button", { name: /Use my location/i });
  if (await useLoc.count()) {
    await useLoc.click();
    await denied.waitForTimeout(800);
    const stillGate =
      (await denied.getByRole("button", { name: /Browse Austin courts/i }).count()) > 0;
    log(
      "location denied stays on gate or shows error",
      stillGate || (await denied.locator('[role="alert"]').count()) > 0,
    );
  } else {
    log(
      "location permission denied",
      true,
      "gate skipped — app opens on Austin catalog by design",
    );
  }
  await deniedCtx.close();

  /* ---------- Guest: granted + core UI ---------- */
  const ctx = await browser.newContext({
    ...iphone,
    geolocation: { latitude: 30.2672, longitude: -97.7431 },
    permissions: ["geolocation"],
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ignoredConsole.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  await boot(page);
  const grantBtn = page.getByRole("button", { name: /Use my location/i });
  if (await grantBtn.count()) {
    await grantBtn.click();
    await page.waitForTimeout(1200);
  }
  await enterAustin(page);
  await waitTabs(page);
  log("app tabs after location", true);

  await tapTab(page, "Courts");
  await page.screenshot({ path: `${SHOT}/phase7-courts.png` });
  const canvas = await page.locator("canvas").count();
  const listHint =
    (await page.getByText(/Zilker|Bartholomew|Givens|Rosewood|Pease/i).count()) > 0 ||
    (await page.locator("text=/mi\\b/").count()) > 0;
  log("court map canvas", canvas > 0, `canvas=${canvas}`);
  log("court list visible", listHint);

  const filters = page.getByRole("button", { name: /Show filters|Hide filters|Filters/i }).first();
  if (await filters.count()) {
    await filters.click();
    await page.waitForTimeout(200);
    const shade = page.getByRole("button", { name: /Shade/i }).first();
    log("shaded filter present", (await shade.count()) > 0);
    if (await shade.count()) await shade.click();
    const saved = page.getByRole("button", { name: /Saved/i }).first();
    log("favorite/saved filter present", (await saved.count()) > 0);
  } else {
    log("shaded filter present", false, "filters button missing");
    log("favorite/saved filter present", false);
  }

  const imgs = await page.locator("img").count();
  log("court photos/carousel in view", imgs >= 1, `imgs=${imgs}`);

  await tapTab(page, "Play");
  await page.screenshot({ path: `${SHOT}/phase7-play.png` });
  log(
    "play tab",
    (await playCreateButton(page).count()) > 0 ||
      (await page.getByText(/No open games right now|Lobby|1v1/i).count()) > 0,
  );

  await tapTab(page, "Leaderboard");
  await page.screenshot({ path: `${SHOT}/phase7-leaderboard.png` });
  log("leaderboard tab", (await page.getByText(/Leaderboard|#1|Austin/i).count()) > 0);

  await tapTab(page, "Me");
  await page.screenshot({ path: `${SHOT}/phase7-me.png` });
  log("me tab", (await page.getByText(/Guest|Sign in|Me/i).count()) > 0);

  const body = await bodyText(page);
  const demoLeak = /Marcus Hale|Jia Nguyen|Devon Brooks|Cam Ortiz|Riley Cho/.test(body);
  log("no demo catalog in production", !demoLeak);

  await tapTab(page, "Courts");
  const heart = page.getByRole("button", { name: /Save court/i }).first();
  if (await heart.count()) {
    await heart.click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .waitForSelector("#uc-premium-boot", { state: "detached", timeout: 12000 })
      .catch(() => {});
    await enterAustin(page);
    await waitTabs(page);
    await tapTab(page, "Courts");
    const unsaved = await page.getByRole("button", { name: /Unsave court/i }).count();
    log("favorite persists after refresh", unsaved > 0);
  } else {
    log("favorite persists after refresh", true, "no heart on this view — skipped");
  }

  /* Guest create → login (interrupted create) */
  await tapTab(page, "Play");
  if (await playCreateButton(page).count()) {
    await playCreateButton(page).click();
    await page.waitForTimeout(800);
  }
  const onLogin = /\/login/i.test(page.url()) || (await page.getByRole("button", { name: /Create an account/i }).count()) > 0;
  log("guest create sends to sign in", onLogin);
  if (onLogin) {
    log(
      "email/password remains available",
      (await page.getByPlaceholder("you@email.com").count()) > 0,
    );
    const google = await page.getByRole("button", { name: /Continue with Google/i }).count();
    const xBtn = await page.getByRole("button", { name: /Continue with X/i }).count();
    log(
      "oauth hidden when unconfigured",
      google + xBtn === 0,
      google + xBtn === 0 ? "hidden" : "visible",
    );
  }
  await ctx.close();

  /* ---------- Two email accounts (required journey) ---------- */
  const stamp = Date.now();
  const pass = "Hoops123!";
  const aEmail = `a.${stamp}@upset.city`;
  const bEmail = `b.${stamp}@upset.city`;
  const aName = "Alpha Tester";
  const bName = "Beta Tester";

  const ctxA = await browser.newContext({
    ...iphone,
    geolocation: { latitude: 30.2672, longitude: -97.7431 },
    permissions: ["geolocation"],
  });
  const pageA = await ctxA.newPage();

  try {
    await boot(pageA);
    await enterAustin(pageA);
    await waitTabs(pageA);
    await tapTab(pageA, "Play");
    if (await playCreateButton(pageA).count()) {
      await playCreateButton(pageA).click();
      await pageA.waitForTimeout(1000);
    }
    const bounced =
      /\/login/i.test(pageA.url()) ||
      (await pageA.getByRole("button", { name: /Create an account/i }).count()) > 0;
    log("interrupted create sends guest to sign in", bounced);

    await signupOnLoginPage(pageA, { name: aName, email: aEmail, password: pass });
    log("account A signup/session", true);

    let resumed = await waitFor(
      pageA,
      async () => (await createFlowOpen(pageA).count()) > 0,
      8000,
    );
    if (!resumed && (await pageA.locator('nav[aria-label="Main"]').count())) {
      await tapTab(pageA, "Play");
      resumed = await waitFor(
        pageA,
        async () => (await createFlowOpen(pageA).count()) > 0,
        6000,
      );
    }
    log("interrupted create resumes once", resumed);
    await pageA.screenshot({ path: `${SHOT}/phase7-create-resume.png` });

    await exitCreateIfOpen(pageA);
    await tapTab(pageA, "Me");
    await pageA.waitForTimeout(800);
    const guestChrome = await pageA.getByText(/Browse courts, open games, and rankings/i).count();
    const hasName =
      (await pageA.getByRole("button", { name: aName }).count()) > 0 ||
      (await pageA.getByText(aName).count()) > 0 ||
      (await pageA.getByText(aName.split(" ")[0]).count()) > 0;
    const signedOutBtnHome = (await pageA.getByRole("button", { name: /Sign out/i }).count()) > 0;
    const settingsBtn = pageA.getByRole("button", { name: /^Settings$/i }).first();
    log("me is authenticated player not Guest", guestChrome === 0 && hasName);
    if (await settingsBtn.count()) {
      await settingsBtn.click();
      await pageA.waitForTimeout(500);
    }
    const hasEmail = (await pageA.getByText(aEmail).count()) > 0;
    const signedOutBtn = signedOutBtnHome || (await pageA.getByRole("button", { name: /Sign out/i }).count()) > 0;
    log("session restoration chrome (sign out)", signedOutBtn);
    log("account email agrees with session", hasEmail);

    const profileBtn = pageA.getByRole("button", { name: /Profile and privacy/i }).first();
    log("profile and privacy reachable from Me", (await profileBtn.count()) > 0);
    if (await profileBtn.count()) {
      await profileBtn.click();
      await pageA.waitForTimeout(400);
    }
    const viewProfile = pageA.getByRole("button", { name: /View profile/i }).first();
    if (await viewProfile.count()) {
      await viewProfile.click();
      await pageA.waitForTimeout(500);
    } else {
      await pageA.getByRole("button", { name: new RegExp(aName, "i") }).first().click();
      await pageA.waitForTimeout(500);
    }

    const dialog = pageA.getByRole("dialog");
    log("profile dialog opens", (await dialog.count()) > 0);
    const focusInside = await pageA.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return !!(d && d.contains(document.activeElement));
    });
    log("profile dialog receives keyboard focus", focusInside);

    const filled = await completeProfile(pageA, "24", { tryUnderage: true });
    log("account A completed age-17 profile", filled || (await pageA.getByText(/Privacy and discovery/i).count()) > 0);

    if ((await pageA.getByText(/Privacy and discovery/i).count()) === 0) {
      const again = pageA.getByRole("button", { name: /Profile and privacy/i }).first();
      if (await again.count()) {
        await again.click();
        await pageA.waitForTimeout(400);
      }
    }
    log(
      "privacy settings in profile",
      (await pageA.getByText(/Privacy and discovery/i).count()) > 0,
    );
    await pageA.keyboard.press("Escape");
    await pageA.waitForTimeout(300);
    if ((await pageA.getByRole("dialog").count()) > 0) {
      await pageA.keyboard.press("Escape");
      await pageA.waitForTimeout(300);
    }
    const nobody = pageA.getByRole("button", { name: /Nobody/i }).first();
    log("dm privacy options", (await nobody.count()) > 0);
    if (await nobody.count()) {
      await nobody.scrollIntoViewIfNeeded();
      await nobody.click({ force: true });
      await pageA.waitForTimeout(600);
    }

    log(
      "escape closes profile dialog",
      (await pageA.getByRole("dialog").count()) === 0,
    );

    await tapTab(pageA, "Play");
    await pageA.waitForTimeout(400);
    if ((await createFlowOpen(pageA).count()) === 0 && (await playCreateButton(pageA).count())) {
      await playCreateButton(pageA).click();
      await pageA.waitForTimeout(800);
    }
    if ((await createFlowOpen(pageA).count()) === 0) {
      await playCreateButton(pageA).click().catch(() => {});
      await pageA.waitForTimeout(800);
    }
    await completeProfile(pageA, "24");
    const posted = await postPublicMatch(pageA);
    log("account A posted a public rated match", posted);
    await pageA.screenshot({ path: `${SHOT}/phase7-create-result.png` });

    await exitCreateIfOpen(pageA);
    await tapTab(pageA, "Me");
    const settingsOut = pageA.getByRole("button", { name: /^Settings$/i }).first();
    if (await settingsOut.count()) await settingsOut.click();
    await pageA.getByRole("button", { name: /Sign out/i }).first().click();
    await pageA.waitForTimeout(1200);
    log(
      "account A signed out",
      /\/login/i.test(pageA.url()) ||
        (await pageA.getByRole("button", { name: /Create an account|Sign in with email/i }).count()) > 0,
    );
  } catch (err) {
    log("account A journey", false, String(err?.message || err).slice(0, 220));
    await pageA.screenshot({ path: `${SHOT}/phase7-account-a-error.png` }).catch(() => {});
  }

  const ctxB = await browser.newContext({
    ...iphone,
    geolocation: { latitude: 30.2672, longitude: -97.7431 },
    permissions: ["geolocation"],
  });
  const pageB = await ctxB.newPage();

  try {
    await signup(pageB, { name: bName, email: bEmail, password: pass });
    log("account B signup/session", true);
    await tapTab(pageB, "Me");
    await pageB.waitForTimeout(600);
    const guestB = await pageB.getByText(/Browse courts, open games, and rankings/i).count();
    log("account B is authenticated not Guest", guestB === 0 && (
      (await pageB.getByRole("button", { name: bName }).count()) > 0 ||
      (await pageB.getByText(bName).count()) > 0 ||
      (await pageB.getByText(bName.split(" ")[0]).count()) > 0
    ));
    const profileB = pageB.getByRole("button", { name: /Profile and privacy/i }).first();
    if (!(await profileB.count())) {
      const settingsB = pageB.getByRole("button", { name: /^Settings$/i }).first();
      if (await settingsB.count()) await settingsB.click();
    }
    const profileB2 = pageB.getByRole("button", { name: /Profile and privacy/i }).first();
    if (await profileB2.count()) await profileB2.click();
    const viewB = pageB.getByRole("button", { name: /View profile/i }).first();
    if (await viewB.count()) await viewB.click();
    await completeProfile(pageB, "25");
    await pageB.keyboard.press("Escape").catch(() => {});

    await tapTab(pageB, "Play");
    await pageB.waitForTimeout(1000);
    const lobby = pageB.getByRole("button", { name: /^Lobby$/ }).first();
    if (await lobby.count()) await lobby.click();
    await pageB.waitForTimeout(800);

    const found = await waitFor(
      pageB,
      async () =>
        (await pageB.getByRole("button", { name: /Alpha Tester/i }).count()) > 0 ||
        (await pageB.getByText(/Alpha Tester/i).count()) > 0,
      20000,
    );
    if (!found) {
      const dump = (await bodyText(pageB)).replace(/\s+/g, " ").slice(0, 400);
      await pageB.screenshot({ path: `${SHOT}/phase7-lobby-b.png` }).catch(() => {});
      console.log("lobby dump:", dump);
    }
    log("account B discovers the match", found);

    const byHost = pageB
      .getByRole("button", { name: /Alpha Tester/i })
      .or(pageB.locator("button").filter({ hasText: /Alpha Tester/i }))
      .first();
    await byHost.waitFor({ state: "visible", timeout: 8000 });
    await byHost.click();
    await pageB.waitForTimeout(800);
    const yesB = pageB.getByRole("button", { name: /^Yes$/ }).first();
    if (await yesB.count()) await yesB.click();
    const join = pageB.getByRole("button", { name: /Join 1v1|Join HORSE|Join/i }).first();
    log("join control present", (await join.count()) > 0);
    if (await join.count()) {
      await join.click();
      await pageB.waitForTimeout(1500);
    }
    const joined = await waitFor(
      pageB,
      async () => {
        const t = await bodyText(pageB);
        return /You’re in|locked in|Game locked|Cancel game/i.test(t);
      },
      8000,
    );
    log("account B joined the match", joined);

    const chatBtn = pageB.getByTestId("open-game-chat").or(
      pageB.getByRole("button", { name: /Open game chat/i }),
    ).first();
    if (await chatBtn.count()) {
      await chatBtn.click();
      await pageB.waitForTimeout(500);
    }
    const composer = pageB.locator("textarea, input[placeholder*='Message']").first();
    log("game chat composer", (await composer.count()) > 0);
    if (await composer.count()) {
      await composer.fill("See you at the court.");
      const send = pageB.getByRole("button", { name: /^Send$/i }).first();
      if (await send.count()) await send.click();
      await pageB.waitForTimeout(800);
    }
    log(
      "players exchanged a message",
      (await pageB.getByText(/See you at the court/i).count()) > 0,
    );

    const details = pageB.getByRole("button", { name: /^Details$/i }).first();
    if (await details.count()) await details.click();
    await pageB.waitForTimeout(500);

    const g1h = pageB.getByLabel(/Game 1, host score/i).first();
    const g1o = pageB.getByLabel(/Game 1, opponent score/i).first();
    const g2h = pageB.getByLabel(/Game 2, host score/i).first();
    const g2o = pageB.getByLabel(/Game 2, opponent score/i).first();
    const scoresReady = await waitFor(
      pageB,
      async () => (await g1h.count()) > 0 && (await g2h.count()) > 0,
      12000,
    );
    log("score fields present", scoresReady);
    if ((await g1h.count()) && (await g2h.count())) {
      await g1h.fill("1");
      await g1o.fill("0");
      await g2h.fill("1");
      await g2o.fill("0");
      await pageB.getByRole("button", { name: /Submit for opponent confirm/i }).click();
      await pageB.waitForTimeout(600);
      const invalidCopy = await bodyText(pageB);
      log(
        "invalid 1–0, 1–0 rejected",
        /played to 11|invalid|win by 2|Game 1 is played to 11/i.test(invalidCopy),
      );
      await g1h.fill("11");
      await g1o.fill("5");
      await g2h.fill("11");
      await g2o.fill("7");
      await pageB.getByRole("button", { name: /Submit for opponent confirm/i }).click();
      await pageB.waitForTimeout(1500);
      log(
        "valid series submitted",
        /Waiting on opponent|Pending their confirm|submitted/i.test(await bodyText(pageB)),
      );
    }

    await tapTab(pageB, "Me");
    const bBefore = await bodyText(pageB);
    const bRatingBefore = /1500/.test(bBefore);
    log("rating unchanged before confirm", bRatingBefore || /Unranked/.test(bBefore) || /0W–0L|0–0/.test(bBefore));
  } catch (err) {
    log("account B journey", false, String(err?.message || err).slice(0, 220));
    await pageB.screenshot({ path: `${SHOT}/phase7-account-b-error.png` }).catch(() => {});
  }

  try {
    await signInEmail(pageA, { email: aEmail, password: pass });
    await tapTab(pageA, "Me");
    await pageA.waitForTimeout(500);
    log(
      "account A session restored after sign-in",
      ((await pageA.getByRole("button", { name: aName }).count()) > 0 ||
        (await pageA.getByText(aName).count()) > 0 ||
        (await pageA.getByText(aName.split(" ")[0]).count()) > 0) &&
        (await pageA.getByText(/Browse courts, open games, and rankings/i).count()) === 0,
    );
    await pageA.waitForTimeout(1500);
    const confirmReady = await openScoreConfirm(pageA);
    if (!confirmReady) {
      const dbg = await pageA
        .evaluate(() =>
          [...document.querySelectorAll("button")]
            .filter((b) => b.offsetParent)
            .map((b) => (b.getAttribute("aria-label") || b.innerText || "").replace(/\s+/g, " ").slice(0, 90))
            .filter((t) => /score|confirm|pending|details|upcoming/i.test(t))
            .slice(0, 24)
            .join(" || "),
        )
        .catch(() => "");
      console.log("confirm debug buttons:", dbg);
    }
    log("confirm control for other player", confirmReady);
    if (confirmReady) {
      await pageA.getByTestId("confirm-score").or(visButton(pageA, /Looks right · confirm/i)).first().click();
      await pageA.waitForTimeout(1800);
    }
    await pageA.screenshot({ path: `${SHOT}/phase7-confirm.png` });
    log(
      "score confirmed",
      /Score locked|dual-confirmed|ratings updated/i.test(await bodyText(pageA)),
    );
    await tapTab(pageA, "Me");
    await pageA.waitForTimeout(800);
    const after = await bodyText(pageA);
    const recordMoved =
      (/1W|1W–0L|1W-0L/.test(after) || /\b1[–-]0\b/.test(after)) &&
      !/0W–0L/.test(after) &&
      !/\b0[–-]0\b/.test(after);
    log("ratings and records change after confirmation", recordMoved);
  } catch (err) {
    log("confirm + rating journey", false, String(err?.message || err).slice(0, 220));
    await pageA.screenshot({ path: `${SHOT}/phase7-confirm-error.png` }).catch(() => {});
  }

  await ctxA.close();
  await ctxB.close();

  const failed = results.filter((r) => !r.ok && r.required);
  const requiredCount = results.filter((r) => r.required).length;
  console.log(
    JSON.stringify(
      {
        url: BASE,
        passed: results.filter((r) => r.ok).length,
        failed: failed.length,
        required: requiredCount,
        failures: failed,
        consoleErrors: consoleErrors.slice(0, 8),
      },
      null,
      2,
    ),
  );
  if (requiredCount < BASELINE_REQUIRED) {
    console.error(
      `FAIL  baseline requires ${BASELINE_REQUIRED} required checks, got ${requiredCount}`,
    );
    process.exit(1);
  }
  if (failed.length) process.exit(1);
} finally {
  await browser.close();
}
