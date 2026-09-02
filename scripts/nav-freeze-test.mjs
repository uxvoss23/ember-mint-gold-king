import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const URL = "http://127.0.0.1:8080/";
const results = [];
const consoleErrors = [];
const pageErrors = [];
const ignoredConsole = /Failed to load resource|net::ERR|Overpass|AbortError|Download the React DevTools/i;

function log(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

async function tapTime(page, locator, label) {
  const t0 = Date.now();
  await locator.click({ timeout: 8000 });
  const ms = Date.now() - t0;
  const hung = ms > 2500;
  log(`tap ${label}`, !hung, `${ms}ms`);
  return ms;
}

async function stillAlive(page) {
  const t0 = Date.now();
  const r = await page.evaluate(() => document.body?.innerText?.length || 0);
  const ms = Date.now() - t0;
  return { ms, len: r, ok: ms < 1500 && r > 20 };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") {
    const t = msg.text();
    if (!ignoredConsole.test(t)) consoleErrors.push(t);
  }
});

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Boot overlay max ~1.8s + hydrate
  await page.waitForSelector("#uc-premium-boot", { state: "detached", timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(500);
  const bootGone = await page.locator("#uc-premium-boot").count();
  log("boot overlay gone", bootGone === 0, `count=${bootGone}`);

  await page.waitForSelector('button[aria-label="Create game"], nav[aria-label="Main"]', { timeout: 15000 });
  await page.screenshot({ path: "/tmp/nav-01-play.png", fullPage: false });

  const tabs = page.locator("nav[aria-label='Main'] button");
  const tabCount = await tabs.count();
  log("tab bar present", tabCount >= 3, `buttons=${tabCount}`);

  // Cycle tabs several times
  const labels = ["Courts", "Play", "Leaderboard", "Me"];
  for (let round = 0; round < 3; round++) {
    for (const label of labels) {
      const btn = page.locator("nav[aria-label='Main'] button", { hasText: label }).first();
      if ((await btn.count()) === 0) {
        log(`tab ${label} exists`, false);
        continue;
      }
      const ms = await tapTime(page, btn, `tab ${label} r${round + 1}`);
      await page.waitForTimeout(80);
      const alive = await stillAlive(page);
      log(`alive after ${label} r${round + 1}`, alive.ok, `${alive.ms}ms text=${alive.len}`);
      if (ms > 2500) {
        await page.screenshot({ path: `/tmp/nav-freeze-${label}-${round}.png` });
      }
    }
  }

  // Back to Play
  await page.locator("nav[aria-label='Main'] button", { hasText: "Play" }).first().click();
  await page.waitForTimeout(200);

  const createBtn = page.getByRole("button", { name: "Create game" }).first();
  log("create button visible", await createBtn.isVisible());
  await tapTime(page, createBtn, "Create game");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/nav-02-create.png" });

  const exploreBack = page.getByRole("button", { name: /Explore/i }).first();
  log("← Explore visible in create", await exploreBack.isVisible().catch(() => false));

  // Continue with no court should still be tappable (Back to Explore)
  const cta = page.locator("button").filter({ hasText: /Continue|Back to Explore|Select a court/i }).last();
  log("create CTA present", await cta.count().then((n) => n > 0));
  if (await cta.count()) {
    const enabled = await cta.isEnabled();
    log("create CTA enabled (not frozen/disabled)", enabled);
    await tapTime(page, cta, "CTA no-court (expect back)");
    await page.waitForTimeout(250);
    const backOnPlay = await page.getByRole("button", { name: "Create game" }).first().isVisible().catch(() => false);
    log("CTA with no court returned to Play", backOnPlay);
  }

  // Enter create again, pick a court if list exists, continue, fill, back
  await page.getByRole("button", { name: "Create game" }).first().click();
  await page.waitForTimeout(250);
  const listToggle = page.getByRole("button", { name: "List" });
  if (await listToggle.count()) {
    await listToggle.click().catch(() => {});
    await page.waitForTimeout(150);
  }
  const courtCard = page.locator("button").filter({ hasText: /mi away|Austin|Court/i }).first();
  const courtBtns = page.locator('[class*="rounded-2xl"] button').first();
  // Prefer tapping a court thumbnail
  const thumbs = page.locator("img").locator("xpath=ancestor::button[1]");
  if (await thumbs.count()) {
    await thumbs.first().click();
    log("picked a court from list", true);
  } else if (await courtBtns.count()) {
    await courtBtns.click().catch(() => log("court tap", false, "click failed"));
  } else {
    log("court list items", false, "none found — map-only?");
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/nav-03-court.png" });

  const continueBtn = page.getByRole("button", { name: /^Continue$/ }).last();
  if (await continueBtn.count()) {
    await tapTime(page, continueBtn, "Continue after court");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "/tmp/nav-04-step2.png" });
    // Fill some step 2 if present
    const yesBall = page.getByRole("button", { name: /^Yes$/ });
    if (await yesBall.count()) {
      await yesBall.first().click();
      log("set bringing ball Yes", true);
    }
    const publicBtn = page.getByRole("button", { name: /Public match/i });
    if (await publicBtn.count()) await publicBtn.first().click().catch(() => {});
    // Back
    const backBtn = page.getByRole("button", { name: /← Back|← Explore/i }).first();
    log("back button on step 2", await backBtn.isVisible().catch(() => false));
    if (await backBtn.count()) {
      await tapTime(page, backBtn, "← Back from step 2");
      await page.waitForTimeout(200);
    }
    const explore2 = page.getByRole("button", { name: /← Explore/i }).first();
    if (await explore2.count()) {
      await tapTime(page, explore2, "← Explore from create");
      await page.waitForTimeout(250);
    }
    const playAgain = await page.getByRole("button", { name: "Create game" }).first().isVisible().catch(() => false);
    log("back to main Play after create fill", playAgain);
    const alive = await stillAlive(page);
    log("page responsive after create back", alive.ok, `${alive.ms}ms`);
  } else {
    log("Continue after court", false, "button missing");
    // Still try Explore
    const ex = page.getByRole("button", { name: /Explore/i }).first();
    if (await ex.count()) await tapTime(page, ex, "← Explore fallback");
  }

  // Lobby tile then back
  await page.locator("nav[aria-label='Main'] button", { hasText: "Play" }).first().click();
  await page.waitForTimeout(150);
  const lobby = page.getByRole("button", { name: /1v1 Lobby/i });
  if (await lobby.count()) {
    await tapTime(page, lobby.first(), "1v1 Lobby");
    await page.waitForTimeout(200);
    const ex = page.getByRole("button", { name: /← Explore/i }).first();
    log("lobby Explore visible", await ex.isVisible().catch(() => false));
    if (await ex.count()) await tapTime(page, ex, "← Explore from lobby");
    const play = await page.getByRole("button", { name: "Create game" }).first().isVisible().catch(() => false);
    log("lobby back to Play", play);
  }

  // Overlay check: boot should not cover
  const overlay = await page.evaluate(() => {
    const boot = document.getElementById("uc-premium-boot");
    const booting = document.documentElement.getAttribute("data-uc-booting");
    const pe = getComputedStyle(document.documentElement).pointerEvents;
    return { boot: !!boot, booting, pe };
  });
  log("no boot overlay leftover", !overlay.boot && overlay.booting !== "1", JSON.stringify(overlay));

  // Rapid back/forth create <-> play
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await page.getByRole("button", { name: "Create game" }).first().click({ timeout: 5000 });
    await page.getByRole("button", { name: /Explore/i }).first().click({ timeout: 5000 });
    const ms = Date.now() - t0;
    log(`rapid create/explore ${i + 1}`, ms < 3000, `${ms}ms`);
  }

  await page.screenshot({ path: "/tmp/nav-05-end.png" });

  log("page errors", pageErrors.length === 0, pageErrors.slice(0, 5).join(" | "));
  log("console errors", consoleErrors.length === 0, consoleErrors.slice(0, 8).join(" | "));
} catch (err) {
  log("script crashed", false, err instanceof Error ? err.message : String(err));
  await page.screenshot({ path: "/tmp/nav-crash.png" }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log("\n--- SUMMARY ---");
console.log(`${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
writeFileSync("/tmp/nav-freeze-results.json", JSON.stringify({ results, pageErrors, consoleErrors }, null, 2));
process.exit(failed.length ? 1 : 0);
