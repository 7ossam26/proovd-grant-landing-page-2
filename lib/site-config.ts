/**
 * Single source of truth for site-wide identity + SEO.
 *
 * Everything the Metadata API, robots.ts and sitemap.ts need reads from here.
 * Environment-specific values (the canonical origin) come from NEXT_PUBLIC_*.
 */
export const siteConfig = {
  /** Brand / site name — used in the title template and social cards. */
  name: "Proovd",

  /**
   * Default meta description. Override per-page via the Metadata API.
   * TODO: replace with the production description before launch.
   */
  description: "Proovd landing page.",

  /**
   * Canonical origin (no trailing slash), e.g. https://proovd.com.
   * Drives `metadataBase`, canonical URLs, robots.txt and sitemap.xml.
   * Falls back to localhost so local/CI builds resolve absolute URLs.
   */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  /**
   * Default Open Graph / Twitter share image, served from /public.
   * TODO: add public/og.png (recommended 1200x630).
   */
  ogImage: "/og.png",

  /** Twitter/X handle — placeholder, replace with the real one. */
  twitterHandle: "@proovd",
} as const;

export type SiteConfig = typeof siteConfig;
