import type { Metadata } from "next";
import { preload } from "react-dom";
import { Analytics } from "@/components/analytics";
import { siteConfig } from "@/lib/site-config";
// Imported for its emitted (hashed) URL so the preload below targets the exact
// same asset the @font-face in proovd.css resolves to — one request, no waste.
import satoshiVariable from "@/styles/fonts/Satoshi-Variable.woff2";
// Global design-system stylesheet (tokens, section modes, element identity,
// and the self-hosted Satoshi @font-face). Source of truth — never edited here.
import "@/styles/proovd.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.siteUrl,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
