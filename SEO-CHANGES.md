# SEO / GEO Changes

Every change from the optimization pass, with the principle behind it. Design system
(`styles/proovd.css`), section structure, layout, and styling were not touched.

## Metadata (single source of truth: `lib/site-config.ts` → `app/layout.tsx`)
| File | Change | Why |
|---|---|---|
| `lib/site-config.ts` | `defaultTitle` = "Proovd — Validate your idea with real pre-orders" (48 chars); real `description` (131 chars) replacing "Proovd landing page." | Title needs primary keyword + brand ≤60; description needs intent match + reason to click. |
| `lib/site-config.ts` | Added `tagline` — one plain "Proovd is a … for …" definition. | GEO: a self-contained sentence AI can quote for "What is Proovd?" Reused in JSON-LD + llms.txt. |
| `lib/site-config.ts` | `siteUrl` fallback `http://localhost:3000` → `https://proovd.co`; added `appUrl`/`founderUrl`/`affiliateUrl`. | Prevents shipping localhost canonical/OG URLs; centralizes the real CTA destinations. |
| `lib/site-config.ts` | Removed placeholder `twitterHandle`. | X account isn't live; a placeholder handle in cards is worse than none. |
| `app/layout.tsx` | `title.default` → `defaultTitle`; `openGraph.title`/`twitter.title` → `defaultTitle`. | Homepage title must describe the product, not just the brand. |
| `app/layout.tsx` | `openGraph.images` given `width:1200`, `height:630`, `alt`. | Correct OG rendering + accessibility; dims prevent scaler guesswork. |
| `app/layout.tsx` | Removed `twitter.site`/`twitter.creator`. | Account not live (owner decision). |
| `app/layout.tsx` | Added `keywords`, `authors`, `creator`, `publisher`, `category`. | Keyword coverage the minimal on-page voice won't carry — goes in metadata, never on-page. |
| `app/layout.tsx` | Added `export const viewport: Viewport`. | Next 16 deprecates `viewport` inside `metadata`; the separate export is the correct API. |
| `app/layout.tsx` | Added media-scoped `<link rel="preload" as="image">` for the hero bg (desktop/mobile). | LCP is the hero CSS background — preloading it (React 19 hoists the links) cuts LCP; media-scoped so each posture fetches one image. |

## Structured data (GEO)
| File | Change | Why |
|---|---|---|
| `lib/faqs.ts` (new) | Extracted the 18-item `FAQS` array here. | One source of truth shared by the FAQ UI (client) and the FAQPage JSON-LD (server) — avoids a client-reference proxy in the server component. |
| `components/faq-section.tsx` | Imports `FAQS` from `lib/faqs`; local copy removed. | Dedupe; behavior unchanged. |
| `app/page.tsx` | Renders one `@graph` (`Organization` + `WebSite` + `FAQPage`) via the existing `JsonLd` helper, above `<main>`. | No structured data existed. Org/WebSite define the entity; FAQPage marks up genuine Q&A. No `SearchAction` (no site search) and no `sameAs` (no live profiles) — never invent facts. |

## Crawlers / AI visibility (GEO)
| File | Change | Why |
|---|---|---|
| `app/robots.ts` | Added an explicit allow rule for GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, CCBot, Applebot-Extended; dropped deprecated `host`. | AI visibility is a stated goal — welcome answer engines explicitly; `host` is non-standard/deprecated in v16. |
| `public/llms.txt` (new) | Brand, one-paragraph definition, key facts (what/who/pricing/creator pay/payouts/risk), canonical + app links. | Standard GEO surface for AI engines; all facts grounded in on-page copy. |

## Links / crawlability
| File | Change | Why |
|---|---|---|
| `components/{hero,navbar,creators-section,days-section,pricing-section}.tsx` | Repointed every CTA and nav link from the non-existent `#start`/`#product`/`#affiliate` anchors to real URLs: founder CTAs + "Got an idea?"/"Got a product?"/"Jump in" → `founderUrl` (`app.proovd.co/login`); "Got an audience?" → `affiliateUrl` (`app.proovd.co/affiliate/login`). | Broken internal anchors hurt crawl + UX. Attribute-only — no text, DOM, or section changes. |

## Core Web Vitals / accessibility
| File | Change | Why |
|---|---|---|
| `components/{hero,navbar,evan-section,creators-section,risk-section,pricing-section}.tsx` | Added real intrinsic `width`/`height` + `decoding="async"` to every raw `<img>`; `loading="lazy"` on below-the-fold images; `fetchPriority="high"` + eager on the hero logo. | Reserves layout boxes → kills CLS; defers off-screen fetches. **Full `next/image` conversion intentionally declined**: GSAP `cloneNode(true)` + `Flip.fit` measure these exact nodes (hero→nav logo handoff, Evan photo flights), and next/image's wrapper/srcset would break those measurements. Dimensions are plain attributes GSAP ignores. |
| Image `alt` text | Audited — already descriptive/compliant (decorative sticker uses `alt=""`+`aria-hidden`). No change. | Recorded for completeness. |

## Tests (kept green for Phase 3)
| File | Change | Why |
|---|---|---|
| `vitest.setup.ts` | Added jsdom stubs: `matchMedia` (reduced-motion = true), `ResizeObserver`, `IntersectionObserver`, `scrollTo`, `document.fonts`. | The built-out page mounts interactive GSAP components; without these the render throws in jsdom. |
| `tests/smoke.test.tsx` | Replaced the obsolete empty-`<main>` assertion with: main present + non-empty, exactly one `<h1>` (hero copy), key section ids exist, JSON-LD parses and contains an `FAQPage`. | The scaffold test contradicted the finished page; new assertions guard the SEO work. |
| `e2e/smoke.spec.ts` | `toHaveTitle(siteConfig.name)` → `toHaveTitle(siteConfig.defaultTitle)`; added checks for the description meta, canonical link, og:image, and the JSON-LD `@graph` types in the production HTML. | The title change would otherwise break the suite; the new checks verify SEO output in the real build. |

## Not done (flagged)
- `<img>` → `next/image` conversion (animation-critical nodes; near-redesign).
- `<footer>`/`<header>` landmarks (new components).
- EvanSection h3-before-h2 DOM reorder (pinned-carousel choreography risk).

## Owner TODOs (launch)
- Drop a real 1200×630 `public/og.png`.
- Set `NEXT_PUBLIC_SITE_URL=https://proovd.co` in the production build env.
- Set prod analytics envs (`NEXT_PUBLIC_CLARITY_PROJECT_ID`, `NEXT_PUBLIC_UMAMI_SRC`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`); confirm Umami subdomain live.
- Add Google Search Console verification (`metadata.verification.google`) + submit `https://proovd.co/sitemap.xml`.
- When live: re-add `twitter.site`/`creator`; add `Organization.sameAs`; add `app/apple-icon.png` + `app/icon.svg`.
