# Proovd — SEO / GEO Audit (Phase 1)

Landing page: Next.js 16.2.10 (App Router). Audit derived from source; the production-build
HTML is exercised by the Playwright e2e (`npm run build && start`, GET `/`) in verification.
Because the `"use client"` section components are still server-rendered into the initial HTML,
the rendered `<head>`/DOM contains exactly the metadata and copy audited here.

Legend: **PASS** / **WARN** / **FAIL**

## 1. Technical SEO
| Area | Verdict | Finding |
|---|---|---|
| Title tag | **FAIL** | `title.default` = `siteConfig.name` = "Proovd" — brand only; no keyword, value prop, or reason to click. Placeholder. |
| Meta description | **FAIL** | `siteConfig.description` = "Proovd landing page." — explicit `TODO` placeholder. |
| Canonical | **WARN** | `alternates.canonical:"/"` is correct; resolves against `metadataBase`. Correct only once the real domain is the build's `NEXT_PUBLIC_SITE_URL`. |
| `metadataBase` | **WARN → blocker** | `new URL(siteConfig.siteUrl)`; `siteUrl` fell back to `http://localhost:3000`. Without the env var, every canonical/OG/Twitter URL points at localhost. |
| OpenGraph | **WARN** | Fields present, but `images:[{url:"/og.png"}]` lacks width/height/alt and the file is missing. |
| OG image asset | **FAIL → blocker** | No `public/og.png` and no `app/opengraph-image.*`. Needs a real 1200×630 asset. |
| Twitter card | **WARN** | `summary_large_image` present; `site`/`creator` = placeholder `@proovd`; image is the missing `/og.png`. |
| Robots meta | **PASS** | `index/follow` + `googleBot` (`max-image-preview:large`, `max-snippet:-1`, `max-video-preview:-1`). |
| Single `<h1>` | **PASS** | Exactly one `<h1>` sitewide (hero headline). |
| Heading hierarchy | **WARN** | EvanSection renders its per-slide `<h3>` before its `<h2>` in DOM order (statement block is last in markup) → h3-before-h2 inversion. Section `<h2>`s otherwise fine, but none defines the product. |
| Landmarks | **WARN** | `<main>` ✓, `<nav aria-label="Main">` ✓, hero `<section aria-label="Proovd">` ✓. No `<header>`/`<footer>`. A footer would be GEO-valuable but is a new component → flagged, not built. |
| `next/image` usage | **FAIL (criterion) / risk** | Every image is a raw `<img>`; no explicit dims, `loading`, or `priority`. Straight conversion is unsafe — GSAP `cloneNode(true)` + `Flip.fit` measure these exact nodes. |
| Image `alt` text | **PASS** | Descriptive throughout (Evan scenes, creator niche+handle); decorative pricing sticker uses `alt=""`+`aria-hidden`. |
| LCP image | **WARN** | LCP is the hero CSS `background-image` (`Hero_desktop.webp`/`Hero_mobile.webp` in `hero.module.css`) — not preloaded (only the font is). |
| `robots.ts` | **PASS → improve** | Valid `*` allow + sitemap + `host`. Wants explicit AI-crawler allow-list; `host` is deprecated in v16. |
| `sitemap.ts` | **PASS** | Single homepage entry, `changeFrequency:"monthly"`, `priority:1`. |
| Favicon / icons | **WARN** | `app/favicon.ico` wired; no apple-icon/svg/manifest/theme-color. |
| 404 | **WARN (minor)** | No `app/not-found.tsx`; Next default 404 served. |
| Font preload | **PASS** | Satoshi preloaded via react-dom `preload()` against the hashed asset URL. |
| Analytics / CWV | **PASS** | Clarity + Umami gated on prod + env vars, `afterInteractive`/`defer`, absent in dev. |
| CLS risk | **WARN** | Unsized raw `<img>` + image-swapping carousel. |

## 2. Copywriting
| Area | Verdict | Finding |
|---|---|---|
| H1 states what / for whom | **FAIL** | `<h1>` "Don't go grey building the wrong thing." — strong hook, zero product definition. On-brand. |
| Above-the-fold intent | **FAIL** | Hero = logo + slogan + CTA; no descriptive subhead. First ~100 words of DOM are slogan + nav labels + "This is Evan…" narrative — answers no search query. |
| Heading scan-path | **WARN** | Headings convey mood, not the offer; only the CreatorsSection `<h2>` is self-explanatory. |
| CTA clarity | **WARN** | "Start"/"Jump in" terse but on-brand; real issue is the broken targets. |
| Broken in-page links | **WARN** | `#start` (all CTAs), `#product`, `#affiliate` have no target elements. Broken internal anchors (crawl + UX). |
| Filler / vague phrases | **PASS** | Concrete, specific (80K subs, $25, 14 days, 72h, 30% commission, Day-14 check). No filler to rewrite. |

## 3. GEO (AI-engine optimization)
| Area | Verdict | Finding |
|---|---|---|
| One quotable product definition | **FAIL** | No self-contained "Proovd is a … for …" sentence anywhere (page or head). An AI asked "What is Proovd?" has nothing clean to quote. |
| Facts as extractable statements | **WARN** | Much is narrative/fragmented; **but** the 18-item FAQ and the risk guarantees are complete, extractable statements — un-marked-up. |
| Structured data | **FAIL** | `JsonLd` helper exists but is used nowhere. No Organization/WebSite/FAQPage. |
| AI-crawler stance | **WARN** | `robots.ts` allows `*` (implicitly AI bots) but doesn't explicitly welcome GPTBot/ClaudeBot/Claude-Web/PerplexityBot/Google-Extended/CCBot. |
| `llms.txt` | **FAIL** | Missing from `public/`. |

## 4. Prioritized fix plan
**Blockers (owner inputs):** production domain for `NEXT_PUBLIC_SITE_URL`, real 1200×630 OG image,
real CTA/app destinations, confirmed social/handle facts, prod analytics IDs.
**High impact (code):** finalize title + description + OG/Twitter metadata (single source in
`site-config.ts`); add Organization + WebSite + FAQPage JSON-LD; explicit AI-crawler allow-list;
`public/llms.txt`; wire real link destinations; ensure the one-sentence definition exists in
metadata + JSON-LD + llms.txt.
**Polish:** LCP hero-image preload; image `width`/`height` + `loading`/`decoding`/`fetchpriority`
for CLS (no `next/image` conversion — animation-critical nodes); `viewport` export; alt/aria review.
**Flagged, not doing:** `<img>`→`next/image` full conversion; `<footer>`/`<header>` components;
EvanSection h3-before-h2 DOM reorder (choreography risk).
