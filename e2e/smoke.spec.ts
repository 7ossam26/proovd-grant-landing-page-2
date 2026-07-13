import { expect, test } from "@playwright/test";
import { siteConfig } from "../lib/site-config";

test("landing page loads: 200, lang=en, title, <main>", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(siteConfig.name);
  await expect(page.locator("main")).toBeAttached();
});
