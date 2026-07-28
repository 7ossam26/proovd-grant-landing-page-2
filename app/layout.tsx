import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { Analytics } from "@/components/analytics";
import { siteConfig } from "@/lib/site-config";
// Imported for its emitted (hashed) URL so the preload below targets the exact
// same asset the @font-face in proovd.css resolves to — one request, no waste.
import satoshiVariable from "@/styles/fonts/Satoshi-Variable.woff2";
// Global design-system stylesheet (tokens, section modes, element identity,
// and the self-hosted Satoshi @font-face). Source of truth — never edited here.
import "@/styles/proovd.css";
// Page-level overrides (e.g. hidden scrollbars) — kept out of proovd.css.
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.defaultTitle,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Keyword coverage the minimal on-page voice won't carry lives here, never on-page.
  keywords: [
    "pre-order validation",
    "idea validation",
    "validate startup idea",
    "creator marketing for founders",
    "crowdfunding alternative",
    "founder tools",
    "reserve now pay later",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.siteUrl,
    siteName: siteConfig.name,
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Proovd — validate your idea with real pre-orders",
      },
    ],
  },
  twitter: {
    // Handle intentionally omitted — the X account isn't live yet.
    card: "summary_large_image",
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    // The owner's mint-hand SVG is the favicon. The PNG (rasterized from the
    // same SVG) is the fallback for engines that can't take an SVG icon —
    // Safari, most notably. app/favicon.ico was DELETED on purpose: it was
    // the stock create-next-app icon, and Next auto-injects any file at that
    // path ahead of these, which handed Safari the Next.js logo.
    icon: [
      { url: "/assets/Proovd-favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
    ],
  },
  // Google Search Console ownership proof. Reads the token from the deploy env
  // (set GOOGLE_SITE_VERIFICATION in Dokploy); Next omits the tag entirely when
  // the var is absent, so nothing ships until you paste the real token.
  verification: {
    // `|| undefined` so an empty env var omits the tag entirely rather than
    // emitting a broken empty <meta content="">, which would fail verification.
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
};

// Next 16 requires viewport/themeColor as a separate export (deprecated in
// `metadata`). No themeColor — that would invent brand chrome.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Preload the brand font (Satoshi) so it never delays LCP. Uses the bundled
  // asset URL, not a hardcoded path, so it always matches the @font-face.
  // First in the queue on purpose: the intro gate's tile LABELS are now the
  // page's first contentful paint, and they are set in Satoshi.
  preload(satoshiVariable, {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  });

  return (
    <html lang="en">
      <body>
        {/* PRELOAD ORDER, since the intro changed what paints first.

            1. The gate's tile texture. The first screen is the intro gate,
               not the hero, and this 135 KB PNG is referenced from a CSS
               Module — i.e. only discoverable AFTER the stylesheet parses, a
               full round trip late on the very first paint. It goes first,
               high. The href is percent-encoded because the filename has a
               space; `url("/assets/btn texture.png")` in the CSS resolves to
               the same URL, so this is one request, not two. Writing it the
               other way would fetch the asset twice.

            2. The hero background, still media-scoped — but the desktop
               entry now points at new_hero_desktop.png (the frame the
               stinger ends on) and NO LONGER carries fetchPriority="high".
               Hero_desktop.webp is no longer referenced by the hero and is
               deliberately no longer preloaded. The demotion is the point:
               the 2.4 MB PNG is not needed until the cut ~2.4s in, whereas
               the 1.6 MB clip must be buffered by ~1.3s, and at high
               priority the two would fight for the same pipe at exactly the
               wrong moment. It still starts immediately — a preload always
               does — it just doesn't outrank the texture or the font. (The
               browser may upgrade it anyway once layout finds the in-
               viewport .bg div; the honest fix is a smaller file, see the
               TODO in hero.module.css.) LCP-safe either way: LCP stops being
               recorded at the first user input, which here is the tile press.

            3. The phone hero keeps the high slot. Hero_mobile.webp is 96 KB
               — it can starve nothing — and phones are the likeliest to skip
               the clip entirely via Save-Data.

            React 19 hoists these <link>s into <head>.

            NO <link rel="preload" as="video">. A preload link can express
            `media` but not Save-Data or prefers-reduced-motion, `as="video"`
            support is uneven, and `as="fetch"` risks a double fetch.
            intro-gate.tsx ships the <video> with preload="none" and flips it
            to "auto" from its effect — the only approach that can respect
            BOTH preferences, and it still gets the whole time a human spends
            reading two buttons to buffer 1.6 MB. What that flip fills is the
            element's own buffer, which is what the readyState check before
            play() actually reads; a link preload would not. */}
        <link
          rel="preload"
          as="image"
          href="/assets/btn%20texture.png"
          fetchPriority="high"
        />
        {/* Desktop deliberately preloads NOTHING for the hero backdrop: on
            the clip path it is the stinger's own last frame, snapshotted out
            of the <video> into a <canvas> (intro-gate.tsx), so the 2.4 MB
            still is never fetched at all. It is loaded lazily, and only on
            the paths where no frame can exist. Phones still preload theirs —
            they always take the still path, and at 96 KB it starves nothing. */}
        {/* No hero backdrop is preloaded on EITHER posture any more. Both now
            end their intro on a snapshot of their own clip's last frame
            (intro-gate.tsx), so the stills are fallback-only — reduced
            motion, Save-Data, refused autoplay, a dead file — and
            intro-gate.tsx loads the right one lazily, the moment it knows a
            frame will never exist. Preloading Hero_mobile.webp at high
            priority actively hurt: 96 KB the happy path never paints,
            outranking the clip that must buffer before the tiles finish
            closing, on the connection least able to afford it. */}
        {children}
        <Analytics />
      </body>
    </html>
  );
}
