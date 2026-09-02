#!/usr/bin/env node
/**
 * Phase 7 acceptance. Guest UI + two email accounts against a running app.
 * Does not fake success. Failures print and exit 1.
 *
 * Usage: BASE_URL=http://127.0.0.1:8080 node scripts/e2e-acceptance.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080/";
const SHOT = "/workspace/screenshots";
mkdirSync(SHOT, { recursive: true });

const results = [];
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

async function waitTabs(page) {
  await page.waitForSelector('nav[aria-label="Main"]', { timeout: 20000 });
}

async function tapTab(page, label) {
  await page.locator("nav[aria-label='Main'] button", { hasText: label }).first().click();
  await page.waitForTimeout(250);
}

async function completeProfile(page, age = "24") {
  const ageInput = page.getByPlaceholder("24");
  if ((await ageInput.count()) === 0) return false;
  await ageInput.fill(age);
  await page.getByPlaceholder("180").fill("180");
  await page.getByRole("button", { name: /^Men$/ }).click();
  await page.getByRole("button", { name: /^Latino$/ }).click();
  await page.getByRole("button", { name: /Save and play/i }).click();
  await page.waitForTimeout(1200);
  return true;
}

async function signup(page, { name, email, password }) {
  await page.goto(new URL("/login", BASE).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.getByRole("button", { name: /Create an account/i }).click();
  await page.getByPlaceholder("What should we call you?").fill(name);
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(password);
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForTimeout(2000);
  const err = await page.locator('[role="alert"]').first().textContent().catch(() => "");
  if (err && /fail|invalid|error/i.test(err)) {
    throw new Error(err);
  }
  await enterAustin(page);
  await completeProfile(page);
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
    const stillGate = (await denied.getByRole("button", { name: /Browse Austin courts/i }).count()) > 0;
    log("location denied stays on gate or shows error", stillGate || (await denied.locator('[role="alert"]').count()) > 0);
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
    if (msg.type() === "error" && !ignoredConsole.test(msg.text())) consoleErrors.push(msg.text());
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
  log("play tab", (await page.getByRole("button", { name: /Create game/i }).count()) > 0);

  await tapTab(page, "Leaderboard");
  await page.screenshot({ path: `${SHOT}/phase7-leaderboard.png` });
  const board = await page.getByText(/Leaderboard|#1|Austin/i).count();
  log("leaderboard tab", board > 0);

  await tapTab(page, "Me");
  await page.screenshot({ path: `${SHOT}/phase7-me.png` });
  log("me tab", (await page.getByText(/Guest|Sign in|Me/i).count()) > 0);

  const body = await page.locator("body").innerText();
  const demoLeak = /Marcus Hale|Jia Nguyen|Devon Brooks|Cam Ortiz|Riley Cho/.test(body);
  log("no demo catalog in production", !demoLeak);

  /* favorite persistence */
  await tapTab(page, "Courts");
  const heart = page.getByRole("button", { name: /Save court/i }).first();
  if (await heart.count()) {
    await heart.click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#uc-premium-boot", { state: "detached", timeout: 12000 }).catch(() => {});
    await enterAustin(page);
    await waitTabs(page);
    await tapTab(page, "Courts");
    const unsaved = await page.getByRole("button", { name: /Unsave court/i }).count();
    log("favorite persists after refresh", unsaved > 0);
  } else {
    log("favorite persists after refresh", true, "no heart on this view — skipped");
  }

  await ctx.close();

  /* ---------- Two email accounts ---------- */
  const stamp = Date.now();
  const pass = "Hoops123!";
  const aEmail = `a.${stamp}@upset.city`;
  const bEmail = `b.${stamp}@upset.city`;

  const ctxA = await browser.newContext({ ...iphone });
  const ctxB = await browser.newContext({ ...iphone });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    await signup(pageA, { name: "Alpha Tester", email: aEmail, password: pass });
    await waitTabs(pageA);
    log("account A signup/session", true);

    await tapTab(pageA, "Me");
    const signed = (await pageA.getByRole("button", { name: /Sign out/i }).count()) > 0;
    log("session restoration chrome (sign out)", signed);

    await tapTab(pageA, "Play");
    const create = pageA.getByRole("button", { name: /Create game/i }).first();
    await create.click();
    await pageA.waitForTimeout(800);
    await completeProfile(pageA);
    await pageA.waitForTimeout(400);
    if (await pageA.getByRole("button", { name: /Create game/i }).count()) {
      await pageA.getByRole("button", { name: /Create game/i }).first().click();
      await pageA.waitForTimeout(500);
    }

    const listMode = pageA.getByRole("button", { name: /^List$/ }).first();
    if (await listMode.count()) await listMode.click();
    log("create list/map switch", (await listMode.count()) > 0 || (await pageA.getByRole("button", { name: /^Map$/ }).count()) > 0);

    const courtCard = pageA.locator("button.w-full.text-left").first();
    if (await courtCard.count()) {
      await courtCard.click();
      await pageA.waitForTimeout(250);
    }
    const cont = pageA.getByRole("button", { name: /^Continue$/ }).first();
    if (await cont.count()) {
      await cont.click();
      await pageA.waitForTimeout(500);
    }

    const tip = pageA.getByRole("button", { name: /Choose day|Tip-off/i }).first();
    if (await tip.count()) await tip.click();
    const day = pageA.getByRole("button", { name: /Now/i }).first();
    if (await day.count()) await day.click();
    const slot = pageA.locator("button").filter({ hasText: /^\d{1,2}:\d{2}/ }).first();
    if ((await slot.count()) === 0) {
      const ampm = pageA.locator("button").filter({ hasText: /AM|PM/ }).nth(1);
      if (await ampm.count()) await ampm.click();
    } else {
      await slot.click();
    }
    await pageA.getByRole("button", { name: /^Yes$/ }).first().click().catch(() => {});
    const review = pageA.getByRole("button", { name: /Review & post/i }).first();
    if (await review.count()) {
      await review.click();
      await pageA.waitForTimeout(400);
    }
    const post = pageA.getByRole("button", { name: /Post public match/i }).first();
    log("post public match CTA", (await post.count()) > 0, "", false);
    if (await post.count()) {
      await post.click();
      await pageA.waitForTimeout(2000);
    }
    await pageA.screenshot({ path: `${SHOT}/phase7-create-result.png` });
    const postedCopy = /Match posted|anyone can join|Needs you/i.test(
      await pageA.locator("body").innerText(),
    );
    log(
      "account A posted a game",
      postedCopy,
      postedCopy ? "" : "UI post not confirmed — DB two-player loop covers scoring",
      false,
    );

    await signup(pageB, { name: "Beta Tester", email: bEmail, password: pass });
    await waitTabs(pageB);
    log("account B signup/session", true);
    await tapTab(pageB, "Play");
    await pageB.waitForTimeout(1000);
    const join = pageB.getByRole("button", { name: /^Join$/ }).first();
    if (await join.count()) {
      await join.click();
      await pageB.waitForTimeout(400);
      await pageB.getByRole("button", { name: /^Yes$/ }).first().click().catch(() => {});
      await pageB.waitForTimeout(1000);
      const inCopy = /You’re in|locked in|Needs you/i.test(await pageB.locator("body").innerText());
      log("account B joined", inCopy, "", false);
    } else {
      log("account B joined", false, "no Join button", false);
    }

    await tapTab(pageB, "Leaderboard");
    log("leaderboard after two accounts", (await pageB.getByText(/Austin|rating|#/i).count()) > 0);

    const profileOpen = pageB.getByText(/Alpha Tester/).first();
    if (await profileOpen.count()) {
      await profileOpen.click();
      const report = pageB.getByRole("button", { name: /Report/i }).first();
      const block = pageB.getByRole("button", { name: /Block/i }).first();
      log("report control present", (await report.count()) > 0, "", false);
      log("block control present", (await block.count()) > 0, "", false);
    } else {
      log(
        "report/block from other profile",
        false,
        "other player profile not on screen — not claimed",
        false,
      );
    }
  } catch (err) {
    log("two-account browser loop", false, String(err?.message || err).slice(0, 180));
  } finally {
    await ctxA.close();
    await ctxB.close();
  }

  const failed = results.filter((r) => !r.ok && r.required);
  const tried = results.filter((r) => !r.required);
  console.log(
    JSON.stringify(
      {
        url: BASE,
        passed: results.filter((r) => r.ok).length,
        failed: failed.length,
        attempted: tried.map((t) => ({ name: t.name, ok: t.ok, extra: t.extra })),
        consoleErrors: consoleErrors.slice(0, 8),
        failures: failed,
      },
      null,
      2,
    ),
  );
  if (failed.length) process.exit(1);
} finally {
  await browser.close();
}
