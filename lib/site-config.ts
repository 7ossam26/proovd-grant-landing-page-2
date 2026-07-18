/**
 * Single source of truth for site-wide identity + SEO.
 *
 * Everything the Metadata API, robots.ts, sitemap.ts, JSON-LD and llms.txt need
 * reads from here. Environment-specific values (the canonical origin) come from
 * NEXT_PUBLIC_* with a production-safe fallback.
 */
export const siteConfig = {
  /** Brand / site name — used in the title template and social cards. */
  name: "Proovd",

  /**
   * Homepage <title> (default). Primary keyword + brand, kept ≤60 chars.
   * Sub-pages get "%s | Proovd" via the title template in layout.tsx.
   */
  defaultTitle: "Proovd",

  /**
   * Default meta description (≤155 chars) — intent-matching, grounded in the
   * on-page story. Override per-page via the Metadata API.
   */
  description:
    "Describe your idea, get matched with vetted creators who pitch it to their audience, and let real backers pre-order before you build.",

  /**
   * One plain, self-contained definition of the product — the answer to
   * "What is Proovd?". Reused verbatim in JSON-LD and llms.txt (GEO).
   */
  tagline:
    "Proovd is a pre-order validation platform for founders: get matched with vetted creators who pitch your idea to their audience, so you only build what people will pay for.",

  /**
   * Canonical origin (no trailing slash). Drives `metadataBase`, canonical URLs,
   * robots.txt, sitemap.xml and JSON-LD @ids. Set NEXT_PUBLIC_SITE_URL in the
   * deploy env; the fallback is the production origin so a missing var can't ship
   * localhost URLs.
   */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://proovd.co",

  /** The Proovd app. CTAs route founders and affiliates to their real entry points. */
  appUrl: "https://app.proovd.co",
  /** Founder conversion CTA target (hero, nav "Jump in", "Start Campaign", pricing). */
  founderUrl: "https://app.proovd.co/login",
  /** Affiliate/creator entry (nav "Got an audience?"). */
  affiliateUrl: "https://app.proovd.co/affiliate/login",

  /**
   * Default Open Graph / Twitter share image, served from /public.
   * TODO(owner): add public/og.png (1200x630).
   */
  ogImage: "/og.png",
} as const;

export type SiteConfig = typeof siteConfig;
