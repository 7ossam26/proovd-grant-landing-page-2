import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const GATE = "[data-intro-gate]";
const TILES = '[aria-label="Where are you at?"] button';
const INTRO_NAMES = ["creators", "risk", "days", "guides"] as const;

async function enterSite(page: Page) {
  await page.goto("/");
  await expect(page.locator(GATE)).toHaveAttribute("data-phase", "choosing", {
    timeout: 30_000,
  });
  await page.locator(TILES).first().click();
  await expect(page.locator(GATE)).toHaveAttribute("data-phase", "gone", {
    timeout: 15_000,
  });
}

async function jumpToProgress(page: Page, name: string, progress: number) {
  const metrics = await page
    .locator(`[data-scroll-intro="${name}"]`)
    .evaluate((track) => {
      const stage = track.querySelector<HTMLElement>(
        ":scope > [data-scroll-intro-stage]",
      );
      if (!stage) throw new Error(`${track} is missing its sticky stage`);
      return {
        top: track.getBoundingClientRect().top + window.scrollY,
        travel: Math.max(1, track.clientHeight - stage.clientHeight),
      };
    });
  const targetY = metrics.top + metrics.travel * progress;
  await page.evaluate((y) => window.scrollTo(0, y), targetY);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return targetY;
}

for (const viewport of [
  { label: "desktop", width: 1280, height: 720 },
  { label: "phone", width: 390, height: 844 },
]) {
  test(`${viewport.label} section intros follow native scroll in both directions`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await enterSite(page);

    for (const name of INTRO_NAMES) {
      for (const progress of [0, 0.5, 1, 0.25]) {
        const targetY = await jumpToProgress(page, name, progress);
        const track = page.locator(`[data-scroll-intro="${name}"]`);

        await expect(track).toHaveAttribute("data-enhanced", "true");
        await expect(track.locator("section")).toHaveAttribute(
          "data-scroll-driven",
          "true",
        );

        const actual = Number(
          (await track.getAttribute("data-scroll-progress")) ?? -1,
        );
        expect(Math.abs(actual - progress)).toBeLessThan(0.012);
        expect(
          await page.evaluate(() => document.body.style.position),
        ).not.toBe("fixed");
        expect(
          Math.abs((await page.evaluate(() => window.scrollY)) - targetY),
        ).toBeLessThan(3);
      }
    }
  });
}
