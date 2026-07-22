import { expect, test } from "@playwright/test";
import { siteConfig } from "../lib/site-config";

test("landing page loads: 200, lang=en, title, single h1, <main>", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(siteConfig.defaultTitle);
  await expect(page.locator("main")).toBeAttached();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("emits SEO metadata and structured data in the production HTML", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    siteConfig.description,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

  const ld = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  const graph = JSON.parse(ld ?? "{}")["@graph"] ?? [];
  const types = graph.map((n: { "@type": string }) => n["@type"]);
  expect(types).toContain("Organization");
  expect(types).toContain("WebSite");
  expect(types).toContain("FAQPage");
});
