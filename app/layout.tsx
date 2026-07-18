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
    icon: "/favicon.ico",
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
  preload(satoshiVariable, {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  });

  return (
    <html lang="en">
      <body>
        {/* Preload the hero background — the LCP element — so it paints without
            waiting on CSS parse. React 19 hoists these <link>s into <head>;
            media-scoped so each posture fetches only its own image. */}
        <link
          rel="preload"
          as="image"
          href="/assets/Hero_desktop.webp"
          media="(min-width: 701px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/assets/Hero_mobile.webp"
          media="(max-width: 700px)"
          fetchPriority="high"
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
