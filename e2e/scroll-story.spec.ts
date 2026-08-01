import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const GATE = "[data-intro-gate]";
const TILES = '[aria-label="Where are you at?"] button';

async function enterSite(page: Page) {
  await page.goto("/");
  await expect(page.locator(GATE)).toHaveAttribute("data-phase", "choosing", {
    timeout: 30_000,
  });
  await page.locator(TILES).first().click();
  await expect(page.locator(GATE)).toHaveAttribute("data-phase", "gone", {
    timeout: 15_000,
  });
  await expect(page.locator("#idea")).toHaveAttribute("data-enhanced", "true");
}

async function storyMetrics(page: Page) {
  return page.locator("#idea").evaluate((root) => {
    const stage = root.querySelector<HTMLElement>("[data-ev-stage]");
    if (!stage) throw new Error("Evan sticky stage is missing");
    return {
      top: root.getBoundingClientRect().top + window.scrollY,
      travel: Math.max(1, root.offsetHeight - stage.offsetHeight),
      scenes: root.querySelectorAll("[data-ev-beat]").length,
    };
  });
}

async function jumpToProgress(page: Page, progress: number) {
  const metrics = await storyMetrics(page);
  const targetY = metrics.top + metrics.travel * progress;
  await page.evaluate((y) => window.scrollTo(0, y), targetY);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return { ...metrics, targetY };
}

test("Evan story is reversible and never owns document scrolling", async ({
  page,
}) => {
  await enterSite(page);

  for (const progress of [0, 0.24, 0.51, 0.78, 1, 0.62, 0.28, 0]) {
    const metrics = await jumpToProgress(page, progress);
    const expectedScene = Math.round(progress * (metrics.scenes - 1));

    expect(
      await page.evaluate(() => document.body.style.position),
      `body was pinned at story progress ${progress}`,
    ).not.toBe("fixed");

    await expect(page.locator("#idea [data-ev-beat][data-active]")).toHaveCount(
      1,
    );
    await expect(page.locator("#idea")).toHaveAttribute(
      "data-active-scene",
      String(expectedScene),
    );

    const actualY = await page.evaluate(() => window.scrollY);
    expect(
      Math.abs(actualY - metrics.targetY),
      `scroll position was rewritten at story progress ${progress}`,
    ).toBeLessThan(3);
  }
});

test("mobile story survives large forward and reverse jumps without clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterSite(page);

  for (const progress of [0, 0.49, 0.96, 0.31, 0.74, 1]) {
    await jumpToProgress(page, progress);

    expect(await page.evaluate(() => document.body.style.position)).not.toBe(
      "fixed",
    );
    await expect(page.locator("#idea [data-ev-beat][data-active]")).toHaveCount(
      1,
    );

    const activeBounds = await page
      .locator("#idea [data-ev-beat][data-active]")
      .evaluate((scene) => {
        const image = scene.querySelector<HTMLElement>("img");
        const headline = scene.querySelector<HTMLElement>("h2, h3");
        const cta = scene.querySelector<HTMLElement>("a");
        const compact = (element: HTMLElement | null) => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          };
        };
        return {
          image: compact(image),
          headline: compact(headline),
          cta: compact(cta),
          width: window.innerWidth,
          height: window.innerHeight,
        };
      });

    for (const bounds of [
      activeBounds.image,
      activeBounds.headline,
      activeBounds.cta,
    ]) {
      if (!bounds) continue;
      expect(bounds.left).toBeGreaterThanOrEqual(-2);
      expect(bounds.right).toBeLessThanOrEqual(activeBounds.width + 2);
      expect(bounds.top).toBeGreaterThanOrEqual(-2);
      expect(bounds.bottom).toBeLessThanOrEqual(activeBounds.height + 2);
    }
  }
});
