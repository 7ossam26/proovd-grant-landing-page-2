import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * The Evan scroll story, rebuilt on native scroll progress.
 *
 * The contract these specs pin is architectural, not cosmetic:
 *
 *   native browser scroll → section progress → story position → visual state
 *
 * i.e. the browser's scroll position is the ONLY source of truth. Everything
 * below is a way of asking "is that still true?" — which is why the progress
 * values are walked in a deliberately jumbled order rather than swept
 * forwards. A smooth 0→1 pass passes even on an engine that secretly keeps
 * its own position; jumping to the end and reversing in uneven steps is what
 * catches one.
 */

const SECTION = "#idea";
const SCENE = "[data-scene]";

/** SCENE_COUNT in components/evan-section.tsx: statement + 4 beats + finale. */
const SCENES = 6;

/** Progress → the scene that must be marked active. */
const EXPECTED: Array<[number, number]> = [
  [0, 0],
  [0.2, 1],
  [0.4, 2],
  [0.6, 3],
  [0.8, 4],
  [1, 5],
];

/** The jumbled walk: forward, to the end, then back down unevenly. */
const NON_LINEAR = [0, 0.24, 0.51, 0.78, 1, 0.62, 0.28, 0];

/** Get past the intro gate, which is a modal and owns the first ~4s. */
async function dismissIntro(page: Page) {
  await page.goto("/");
  const gate = page.locator("[data-intro-gate]");
  if (await gate.count()) {
    await expect(gate).toHaveAttribute("data-phase", "choosing", {
      timeout: 30_000,
    });
    await page
      .locator('[aria-label="Where are you at?"] button')
      .first()
      .click();
    await expect(gate).toHaveAttribute("data-phase", "gone", {
      timeout: 15_000,
    });
  }
  await expect(page.locator(SECTION)).toHaveAttribute("data-enhanced", "true");
}

/** Put the page at an exact fraction of the section's own scroll track, then
 *  let the rAF-coalesced paint run. The TEST drives the scroll — the point is
 *  that the section only ever reads it. */
async function scrollToProgress(page: Page, progress: number) {
  await page.evaluate((p) => {
    const track = document.querySelector<HTMLElement>("[data-track]");
    const stage = document.querySelector<HTMLElement>("[data-stage]");
    if (!track || !stage) throw new Error("track/stage missing");
    const top = track.getBoundingClientRect().top + window.scrollY;
    const available = Math.max(track.offsetHeight - stage.offsetHeight, 1);
    window.scrollTo(0, Math.round(top + available * p));
  }, progress);
  // two frames: one for the scroll event's rAF, one for the paint it queues
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}

const activeScene = (page: Page) =>
  page.locator(SECTION).getAttribute("data-active-scene");

/** The finale's CTA. `exact` matters: accessible-name matching is
 *  case-insensitive and substring-based by default, so a loose
 *  "Start campaign" also matches the creators and days sections'
 *  "Start Campaign" buttons — three elements, and a strict-mode violation. */
const startCampaign = (page: Page) =>
  page.getByRole("link", { name: "Start campaign", exact: true });

const bodyPinned = (page: Page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return document.body.style.position === "fixed" || s.position === "fixed";
  });

test.describe("native scroll progress", () => {
  test("marks the expected scene at known progress values", async ({
    page,
  }) => {
    await dismissIntro(page);
    for (const [progress, scene] of EXPECTED) {
      await scrollToProgress(page, progress);
      expect(await activeScene(page), `progress ${progress}`).toBe(
        String(scene),
      );
    }
  });

  test("keeps exactly one scene active through a non-linear walk", async ({
    page,
  }) => {
    // Forward jumps, a jump to the end, and an uneven reverse — the ordering
    // is the test. Any hidden per-scene state shows up here as two actives,
    // none at all, or a scene that disagrees with the scroll position.
    await dismissIntro(page);
    for (const progress of NON_LINEAR) {
      await scrollToProgress(page, progress);

      const marked = await page.locator(`${SCENE}[data-active]`).count();
      expect(marked, `one active at progress ${progress}`).toBe(1);

      // …and the marked scene is the one the arithmetic names, so the
      // attribute and the visible state cannot drift apart.
      const expected = Math.min(
        SCENES - 1,
        Math.max(0, Math.round(progress * (SCENES - 1))),
      );
      expect(await activeScene(page), `scene at ${progress}`).toBe(
        String(expected),
      );
    }
  });

  test("reversing restores the same scene the forward pass showed", async ({
    page,
  }) => {
    await dismissIntro(page);
    const forward: string[] = [];
    for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      await scrollToProgress(page, p);
      forward.push((await activeScene(page)) ?? "");
    }
    const reverse: string[] = [];
    for (const p of [1, 0.8, 0.6, 0.4, 0.2, 0]) {
      await scrollToProgress(page, p);
      reverse.push((await activeScene(page)) ?? "");
    }
    expect(reverse).toEqual([...forward].reverse());
  });

  test("a jump from start to end and back lands correctly, immediately", async ({
    page,
  }) => {
    // The scrollbar-drag case: no intermediate frames at all.
    await dismissIntro(page);
    await scrollToProgress(page, 0);
    expect(await activeScene(page)).toBe("0");
    await scrollToProgress(page, 1);
    expect(await activeScene(page)).toBe(String(SCENES - 1));
    await scrollToProgress(page, 0);
    expect(await activeScene(page)).toBe("0");
  });

  test("never pins the body and never rewrites the scroll position", async ({
    page,
  }) => {
    // The single worst failure mode the old system had. A pinned body freezes
    // the whole site; a section that writes scrollY fights the user.
    await dismissIntro(page);
    for (const progress of NON_LINEAR) {
      await scrollToProgress(page, progress);
      expect(await bodyPinned(page), `pinned at ${progress}`).toBe(false);

      const before = await page.evaluate(() => window.scrollY);
      // Sit still for several frames. If anything in the section wants to
      // move the page — a snap, a magnet, a glide — this is where it shows.
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => window.scrollY);
      expect(after, `scrollY rewritten at ${progress}`).toBe(before);
    }
  });

  test("hidden scenes cannot intercept clicks", async ({ page }) => {
    await dismissIntro(page);
    for (const progress of NON_LINEAR) {
      await scrollToProgress(page, progress);
      const claiming = await page.evaluate(() => {
        const scenes = Array.from(
          document.querySelectorAll<HTMLElement>("[data-scene]"),
        );
        return scenes
          .map((el, i) => ({ i, pe: getComputedStyle(el).pointerEvents }))
          .filter((s) => s.pe !== "none").length;
      });
      // At most one scene is hit-testable, so nothing invisible can sit over
      // a button and swallow the click.
      expect(claiming, `interactive scenes at ${progress}`).toBeLessThanOrEqual(
        1,
      );
    }
  });

  test("the finale CTA is reachable and is the real hit-test target", async ({
    page,
  }) => {
    await dismissIntro(page);
    await scrollToProgress(page, 1);

    const cta = startCampaign(page);
    await expect(cta).toBeVisible();

    // Visible is not enough — an invisible overlay could still be on top.
    // Ask the document what is actually at the button's centre.
    const hit = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll("a")).find(
        (a) => a.textContent?.trim() === "Start campaign",
      );
      if (!link) return "missing";
      const r = link.getBoundingClientRect();
      const el = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      return el && link.contains(el) ? "cta" : (el?.tagName ?? "none");
    });
    expect(hit).toBe("cta");
  });

  test("recovers from a resize taken in the middle of the story", async ({
    page,
  }) => {
    await dismissIntro(page);
    await scrollToProgress(page, 0.5);
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.waitForTimeout(300);
    // Geometry changed under the reader, so the SCENE may legitimately differ;
    // what must hold is that the section still reports a coherent state and
    // has not pinned or moved the page.
    const scene = Number(await activeScene(page));
    expect(Number.isInteger(scene)).toBe(true);
    expect(scene).toBeGreaterThanOrEqual(0);
    expect(scene).toBeLessThan(SCENES);
    expect(await bodyPinned(page)).toBe(false);

    // …and it still tracks scroll correctly at the new size.
    await scrollToProgress(page, 1);
    expect(await activeScene(page)).toBe(String(SCENES - 1));
  });

  test("survives a tab switch and repaints on return", async ({ page }) => {
    await dismissIntro(page);
    await scrollToProgress(page, 0.6);
    const before = await activeScene(page);
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    expect(await activeScene(page)).toBe(before);
    expect(await bodyPinned(page)).toBe(false);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("keeps the active image and headline inside the viewport", async ({
    page,
  }) => {
    await dismissIntro(page);
    // A beat, not the statement or the finale.
    await scrollToProgress(page, 0.4);
    expect(await activeScene(page)).toBe("2");

    const fits = await page.evaluate(() => {
      const active = document.querySelector<HTMLElement>(
        "[data-scene][data-active]",
      );
      if (!active) return null;
      const img = active.querySelector("img");
      const heading = active.querySelector("h3");
      if (!img || !heading) return null;
      const vh = window.innerHeight;
      const i = img.getBoundingClientRect();
      const h = heading.getBoundingClientRect();
      return {
        imgInside: i.top >= 0 && i.bottom <= vh,
        headingInside: h.top >= 0 && h.bottom <= vh,
        headingHasWidth: h.width > 0,
      };
    });
    expect(fits).not.toBeNull();
    expect(fits?.imgInside, "image within the viewport").toBe(true);
    expect(fits?.headingInside, "headline within the viewport").toBe(true);
    expect(fits?.headingHasWidth).toBe(true);
  });

  test("keeps the CTA reachable on a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await dismissIntro(page);
    await scrollToProgress(page, 1);
    const cta = startCampaign(page);
    await expect(cta).toBeInViewport();
    expect(await bodyPinned(page)).toBe(false);
  });
});

test.describe("reduced motion", () => {
  test("gives a static, readable story with no sticky stage", async ({
    page,
  }) => {
    // emulateMedia rather than `test.use({ reducedMotion })`: the preference
    // has to be in force for the FIRST render (the section reads it in a
    // state initializer so a reduced-motion visitor never sees even one
    // painted frame of the sticky presentation), and this applies it before
    // the navigation, explicitly, on every browser build.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const gate = page.locator("[data-intro-gate]");
    if (await gate.count()) {
      await expect(gate).toHaveAttribute("data-phase", "choosing", {
        timeout: 30_000,
      });
      await page
        .locator('[aria-label="Where are you at?"] button')
        .first()
        .click();
      await expect(gate).toHaveAttribute("data-phase", "gone", {
        timeout: 15_000,
      });
    }

    // The section is never enhanced, so the scenes stay in normal flow.
    await expect(page.locator(SECTION)).toHaveAttribute(
      "data-enhanced",
      "false",
    );

    const state = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>("[data-stage]");
      const scenes = Array.from(
        document.querySelectorAll<HTMLElement>("[data-scene]"),
      );
      return {
        stagePosition: stage ? getComputedStyle(stage).position : "",
        hidden: scenes.filter((s) => {
          const cs = getComputedStyle(s);
          return cs.visibility === "hidden" || Number(cs.opacity) < 0.99;
        }).length,
        count: scenes.length,
      };
    });
    expect(state.stagePosition).not.toBe("sticky");
    expect(state.count).toBe(SCENES);
    // Every scene is readable at once — a static presentation, not a faster
    // animated one.
    expect(state.hidden).toBe(0);

    // The whole story is present as text, including the closing action.
    await expect(
      page.getByRole("heading", { name: "Evan has a business idea" }),
    ).toBeVisible();
    await expect(startCampaign(page)).toBeVisible();
  });
});

test.describe("no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders the complete story in normal document flow", async ({
    page,
  }) => {
    await page.goto("/");

    // Nothing enhanced anything, so the server markup is what is on screen.
    await expect(page.locator(SECTION)).toHaveAttribute(
      "data-enhanced",
      "false",
    );
    await expect(page.locator(`${SECTION} ${SCENE}`)).toHaveCount(SCENES);

    // Every beat's headline and body is readable, and so is the CTA.
    for (const title of [
      "Evan has a business idea",
      "He tells Proovd",
      "Proovd finds buyers",
      "Evan starts building",
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    // …the opening statement…
    await expect(page.getByRole("heading", { name: /is Evan/ })).toBeVisible();
    // …and the closing action.
    await expect(startCampaign(page)).toBeVisible();

    // …and the images are real, loadable images rather than CSS backgrounds.
    const imgs = await page.locator(`${SECTION} img`).count();
    expect(imgs).toBeGreaterThanOrEqual(SCENES - 2);
  });
});
