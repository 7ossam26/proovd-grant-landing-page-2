import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Regression guards for the intro gate's production-failure modes.
 *
 * The gate (components/intro-gate.tsx) is a full-screen z-1000 overlay whose
 * `data-phase` walks loading → choosing → picked → sealing → playing → done
 * → gone. Its design contract is SILENT DEGRADATION: whatever fails — the
 * stinger clip, the crank loader, a slow network — the overlay must still
 * leave (`gone`) and every scroll lock must release. A gate that never
 * leaves is an opaque page-sized trap; a body left `position: fixed`
 * freezes the entire site. These specs pin both invariants.
 */

const GATE = "[data-intro-gate]";
const TILES = '[aria-label="Where are you at?"] button';

/** Wait for the gate's data-phase to reach `phase`. Only stable phases are
 *  waited on here: `choosing` holds until a tile is pressed (the 20s idle
 *  backstop releases the HERO only, never the gate) and `gone` is terminal. */
async function waitForPhase(page: Page, phase: string, timeout: number) {
  await expect(page.locator(GATE)).toHaveAttribute("data-phase", phase, {
    timeout,
  });
}

/** Press the first choice tile ("I have an Idea"). The pick is sticky and
 *  arms the 7s sequence deadline, so `gone` is guaranteed from here even if
 *  every media path fails. */
async function pickFirstTile(page: Page) {
  await page.locator(TILES).first().click();
}

/** Is a scroll hold currently pinning the body? Every hold in this repo
 *  (holdScroll, holdInput, the Evan statement) writes exactly this. */
function bodyPinned(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.style.position === "fixed");
}

test("intro reaches a terminal state after a pick (normal path)", async ({
  page,
}) => {
  // Guards: the happy path must fully terminate. A pick chain that stalls
  // anywhere between `picked` and `gone` leaves the visitor behind an opaque
  // overlay with the page scroll-locked — reload-only failure in production.
  await page.goto("/");
  await waitForPhase(page, "choosing", 30_000);
  await pickFirstTile(page);
  await waitForPhase(page, "gone", 15_000);

  // No hold may survive the intro: a leaked body pin freezes the site.
  expect(await bodyPinned(page)).toBe(false);
  // Every load begins at the top (scrollRestoration = "manual" + scrollTo);
  // the hero→Evan jack assumes it.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // The hero must actually be revealed — its h1 is parked at
  // visibility:hidden until whenIntroDone() resolves.
  await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });
});

test("intro still terminates when the stinger video is blocked", async ({
  page,
  context,
}) => {
  // Guards: a 404'd / proxy-blocked / CDN-failed stinger clip. The media
  // error path must route to finish() → finishIntro(), never strand the
  // opaque overlay waiting for a `canplaythrough` that will never come.
  await context.route(/(desktop-video|mobile-video)\.mp4/, (route) =>
    route.abort(),
  );

  await page.goto("/");
  await waitForPhase(page, "choosing", 30_000);
  await pickFirstTile(page);
  // Silent degradation: no clip, no canvas snapshot — but the gate leaves.
  await waitForPhase(page, "gone", 15_000);
  expect(await bodyPinned(page)).toBe(false);
});

test("intro still terminates when the crank loader clip is blocked", async ({
  page,
  context,
}) => {
  // Guards: the pre-choice loader's clip failing. The 0→100% count is
  // timer-driven and must reach `choosing` on its own clock — a loader that
  // waits on a dead clip would hold the whole page at `loading` forever.
  await context.route(/crank-load\.mp4/, (route) => route.abort());

  await page.goto("/");
  // The count runs LOAD_MS + LOAD_TAIL (~2s) regardless of the clip; 15s
  // proves it did not block on the aborted fetch.
  await waitForPhase(page, "choosing", 15_000);
  await pickFirstTile(page);
  await waitForPhase(page, "gone", 15_000);
});

test("intro terminates under constrained bandwidth", async ({
  page,
  context,
  browserName,
}) => {
  // Guards: a real-world slow connection. The clip gets T.buffer (1.2s) to
  // reach HAVE_ENOUGH_DATA and is DROPPED if it can't — the sequence must
  // finish on the 7s deadline's watch, never wait out a crawling download.
  test.skip(browserName !== "chromium", "CDP network throttling only");
  test.setTimeout(120_000);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  await page.goto("/");
  await waitForPhase(page, "choosing", 60_000);
  await pickFirstTile(page);
  await waitForPhase(page, "gone", 30_000);
  expect(await bodyPinned(page)).toBe(false);
});

test("scroll locks always release on the way down the page", async ({
  page,
}) => {
  // Guards: a leaked scroll hold. The Evan statement hold, the whisper
  // magnet's seam jacks and every arrival lock (creators, risk, days,
  // guides) pin the body with position:fixed; each MUST release on its
  // settle or its backstop. A pin that survives freezes the whole site —
  // the single worst failure mode this page has.
  test.setTimeout(180_000);

  await page.goto("/");
  await waitForPhase(page, "choosing", 30_000);
  await pickFirstTile(page);
  await waitForPhase(page, "gone", 15_000);
  await page.waitForTimeout(1000);

  const unpinned = () => document.body.style.position !== "fixed";

  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(400);
    if (await bodyPinned(page)) {
      // A hold is legal mid-transition; a hold that never releases is the
      // bug. Every hold has a timer backstop well under 15s.
      try {
        await page.waitForFunction(unpinned, undefined, { timeout: 15_000 });
      } catch {
        throw new Error(
          `scroll lock never released: body stayed position:fixed for 15s ` +
            `after wheel gesture ${i + 1} of 12 — a leaked ` +
            `holdScroll/holdInput pin freezes the entire site`,
        );
      }
    }
  }

  // Terminal state: no pin left anywhere, and the page actually travelled
  // (a document stuck at scrollY 0 after 12 wheel gestures means input was
  // swallowed for good).
  await page.waitForFunction(unpinned, undefined, { timeout: 15_000 });
  expect(await bodyPinned(page)).toBe(false);
  const y = await page.evaluate(() => window.scrollY);
  expect(y, "page never moved off the top after 12 wheels").toBeGreaterThan(0);
});
