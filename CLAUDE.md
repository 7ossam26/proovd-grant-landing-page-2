# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

npm only. Dev server: `npm run dev` (http://localhost:3000).

| Command | Notes |
| --- | --- |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm run lint` | Biome check (lint + format diagnostics) — no ESLint/Prettier |
| `npm run format` | Biome format, writes changes |
| `npm test` | Vitest unit tests (jsdom + RTL). Single file: `npx vitest run tests/smoke.test.tsx` |
| `npm run test:e2e` | Playwright; its webServer runs `build && start` on port 3000 (reuses an already-running server locally — a running dev server will be tested instead of the prod build) |

`vitest.setup.ts` stubs what jsdom lacks and the client components touch on mount — `matchMedia` (reporting `prefers-reduced-motion: reduce`, so every effect takes its static short-circuit), `ResizeObserver`/`IntersectionObserver`, `scrollTo`, and `document.fonts`. Add a stub there rather than guarding component code for the test environment.

## What this is

Single-page marketing site for **Proovd** (Next.js 16 App Router + TypeScript, Turbopack). One route: [app/page.tsx](app/page.tsx) composes section components in order (Hero, Navbar, Evan, Creators, Risk, Days, Pricing, FAQ) with `HoverFX` last — most are one viewport tall; Evan is a multi-viewport scroll story. Deployed as a Docker standalone image via Dokploy on push to `main` (see DEPLOY.md); all env vars are `NEXT_PUBLIC_*` and inlined at build time.

## Design system — three layers

1. **Decision layer:** `docs/design-system/Proovd DNA.md` — the brand/UX/motion spec. The `§` numbers in code comments (e.g. "§6.4") refer to its sections. Read it before building or restyling any UI; it contains hard rules (color pairings, "nothing teleports", fail-loud font/motion checks, no shadows/gradients, sharp radii). Its GSAP-only motion rule is deliberately overridden in this codebase — see Motion below.
2. **Value layer:** [styles/proovd.css](styles/proovd.css) — tokens, section modes, element identity, and the Satoshi `@font-face`. **Never edit or format this file** (it's excluded from Biome); it is replaced wholesale from `docs/design-system/`. Components never hardcode hex values — apply a section mode class (`.mode-none` / `.mode-dark` / `.mode-light` / `.mode-drawer`) and read the semantic slot variables (`--mode-title`, `--mode-body`, `--btn1-*`, …) or the token vars.
3. **Component layer:** CSS Modules co-located with each component (`components/*.module.css`). No Tailwind, no CSS-in-JS, no UI libraries. [styles/globals.css](styles/globals.css) holds only page-level overrides (hidden scrollbars, the `data-hover="underline"` ::after scaffolding).

Fonts: Satoshi is load-bearing, self-hosted in `styles/fonts/`. `app/layout.tsx` imports the woff2 for its hashed URL (ambient decl in `types/assets.d.ts`) and `preload()`s it so the preload always matches the `@font-face` request.

## Motion & scroll architecture

- **Scrolling is 100% native, site-wide.** No wheel/touch hijacking, no CSS scroll-snap, no committed scroll glides — never reintroduce a scroll authority. Scroll-linked behavior reads position passively (rAF-queued passive listeners) and never writes it. Two exceptions, both in the Evan section: the "whisper magnet" (nudges an idle scroll toward the nearest step; must always yield instantly to any input) and the intro hold (wheel/touch held while the "This is Evan…" statement plays, settling onto the section top — user-requested; releases the instant the story takes over, with fail-open releases on throw/cancel/unmount).
- **GSAP is removed — motion runs on native primitives** (a deliberate user decision overriding DNA §6). [lib/motion.ts](lib/motion.ts) is the shared kit: `EASE` (cubic-beziers matching the old GSAP curves — power2/3/4.out, back.out tiers), `splitWords` (SplitText word-mask parity incl. the 0.18em descender allowance), `onceInView` (ScrollTrigger `once` parity via IntersectionObserver), and `playFrom`/`playTo` (Web Animations API with gsap-style `.from()` immediate-render parking and freeze-on-interrupt retargeting). Continuous loops (creators wheel, Evan) drive rAF directly with `easeFn`.
- **Section conventions are unchanged:** every section is a `"use client"` component animating inside `useLayoutEffect`, with cleanup that cancels its animations/observers and clears its inline styles, an early bail-out under `prefers-reduced-motion: reduce` (navbar excepted — it only skips the logo flight), a `document.fonts.ready` race before word splits, and fail-open try/catch so a throwing motion layer never leaves content hidden.
- **[components/evan-section.tsx](components/evan-section.tsx)** is a faithful port of a user-supplied reference scroll story ("Proovd Scroll Storyyy") with its own self-contained rAF engine: scroll-chasing exponential smoothing plus CSS transitions drive its text/media choreography, and THREE.js (dynamically imported) renders the corner-peel page transition with a CSS crossfade fallback. It scopes a fluid unit `--u` to the section (uniform zoom of a 1440×800 reference — never applied to the page root) and a product-mode dark theme (`#011E0B`, the navbar's documented literal). Don't let its scroll-chasing patterns leak into other sections.
- **Cross-component wiring is DOM-based, not props:** the hero logo Flip-flies into the navbar via `[data-hero-logo]`/`[data-nav-logo]` clone + `Flip.fit`; navbar goes transparent over `#days`; Evan measures the rendered `nav[aria-label="Main"]` for its sticky offsets. Every CTA and nav link points at the real app (`siteConfig.founderUrl` / `affiliateUrl`), never at a section anchor — the section ids (`#idea`, `#creators`, `#risk`, `#days`, `#pricing`, `#faq`) exist for the scroll machinery and the smoke test, not for navigation.
- **Hover/press effects** come from `data-hover="primary"|"underline"` attributes, bound once on mount by [components/hover-fx.tsx](components/hover-fx.tsx) — which is why it renders last in `page.tsx`. New interactive elements opt in via the attribute, not their own listeners.
- `lib/proovd-motion.js` is an intentional stub — do not implement it.

## Other conventions

- Images are plain `<img>` tags serving pre-optimized WebP from `public/assets/` — not `next/image`.
- SEO reads from one place: [lib/site-config.ts](lib/site-config.ts) drives the Metadata API in `app/layout.tsx`, `app/robots.ts`, and `app/sitemap.ts`. `lib/json-ld.tsx` renders JSON-LD schemas defined at the call site.
- Analytics (`components/analytics.tsx`) renders only when `NODE_ENV === "production"` **and** the relevant `NEXT_PUBLIC_*` vars are set — development stays free of third-party scripts.
- Biome: double quotes, 2-space indent, 80-char lines; `docs/`, `public/`, and `styles/` are excluded from it.
- Path alias `@/*` maps to the repo root (also aliased in `vitest.config.ts`).
