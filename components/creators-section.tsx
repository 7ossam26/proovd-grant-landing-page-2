"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { easeFn, holdScroll, onceInView } from "@/lib/motion";
import { bindScrollIntro, smoothstep } from "@/lib/scroll-intro";
import { siteConfig } from "@/lib/site-config";
import car from "./creators-carousel.module.css";
import styles from "./creators-section.module.css";

type Platform = "tiktok" | "youtube" | "instagram";

// strip/panel colors come straight from the card sheet; fg picks the
// readable ink for each
const CREATORS: Array<{
  img: string;
  niche: string;
  handle: string;
  followers: string;
  platform: Platform;
  bg: string;
  fg: "dark" | "light";
}> = [
  {
    img: "/assets/Creator-1.webp",
    niche: "Lifestyle",
    handle: "@liv.days",
    followers: "96K",
    platform: "instagram",
    bg: "#86A28C",
    fg: "light",
  },
  {
    img: "/assets/Creator-2.webp",
    niche: "Streaming",
    handle: "@nova.plays",
    followers: "143K",
    platform: "tiktok",
    bg: "#D3F8C5",
    fg: "dark",
  },
  {
    img: "/assets/Creator-3.webp",
    niche: "Fitness",
    handle: "@formcheck",
    followers: "312K",
    platform: "youtube",
    bg: "#E9FFE1",
    fg: "dark",
  },
  {
    img: "/assets/Frame 4.webp",
    niche: "Music",
    handle: "@spinbackk",
    followers: "88K",
    platform: "tiktok",
    bg: "#D6F0FF",
    fg: "dark",
  },
  {
    img: "/assets/Creator-5.webp",
    niche: "Music",
    handle: "@miso.mixes",
    followers: "205K",
    platform: "instagram",
    bg: "#41ED98",
    fg: "dark",
  },
  {
    img: "/assets/Creator-6.webp",
    niche: "Fashion",
    handle: "@LM_styles",
    followers: "228K",
    platform: "tiktok",
    bg: "#F5FA9F",
    fg: "dark",
  },
  {
    img: "/assets/Creator-7.webp",
    niche: "Branding",
    handle: "@brandkid",
    followers: "74K",
    platform: "youtube",
    bg: "#013F17",
    fg: "light",
  },
  {
    img: "/assets/Creator-8.webp",
    niche: "Fashion",
    handle: "@inkandlenses",
    followers: "156K",
    platform: "instagram",
    bg: "#F2FF8B",
    fg: "dark",
  },
  {
    img: "/assets/Creator-9.webp",
    niche: "Design",
    handle: "@designbyrei",
    followers: "119K",
    platform: "tiktok",
    bg: "#86A28C",
    fg: "light",
  },
  {
    img: "/assets/Creator-10.webp",
    niche: "Lifestyle",
    handle: "@dailydose.d",
    followers: "182K",
    platform: "instagram",
    bg: "#012D10",
    fg: "light",
  },
  {
    img: "/assets/Creator-11.webp",
    niche: "Fitness",
    handle: "@repsbyluca",
    followers: "267K",
    platform: "youtube",
    bg: "#EEF4EE",
    fg: "dark",
  },
  {
    img: "/assets/Creator-12.webp",
    niche: "Streaming",
    handle: "@streamsz",
    followers: "331K",
    platform: "tiktok",
    bg: "#2FE58A",
    fg: "dark",
  },
];

const INK = { dark: "#013F17", light: "#E9FFE1" } as const;

// ONE source for the section's words, on BOTH postures (owner: "use the same
// copy from mobile to desktop"). These are the phone guide's lines; desktop
// used to carry its own eyebrow + a longer heading, which is exactly the
// drift the Evan story's shared copy table was introduced to prevent. Each
// tree still owns its own LAYOUT — only the strings are shared.
const COPY = {
  headline: "Creators do your marketing",
  pitch:
    "They pitch your idea to their followers and only get paid when you do.",
  cta: "Start Campaign",
} as const;

// The blank beat between the seam and the entrance (owner: "transition page
// then play intro so for less than second there's a fully white page there").
// Both trees park every visible thing under `.isLive` and reveal it on
// [data-in], so holding [data-in] back for this long IS the fully white page:
// the section has taken the screen, nothing is on it yet. Timed from the PIN,
// not from the trigger — the trigger is crossed mid-jack, so counting from
// there would spend the beat while the page is still travelling.
const BLANK_MS = 460;

// The entrance hold itself now lives in lib/motion.ts (`holdScroll`) — it was
// born here (owner: "stop scrolling at the intro when the carousel spinning",
// then "sometimes the section before it I can slide through the animation")
// and grew into the shared arrival lock every transition-owning section uses.

// the platforms' own marks — TikTok as its app tile, YouTube's play,
// Instagram's gradient camera — not generic icons
function PlatformLogo({ platform }: { platform: Platform }) {
  if (platform === "youtube") {
    return (
      <svg
        className={styles.logo}
        viewBox="0 0 576 512"
        aria-label="YouTube"
        role="img"
      >
        <path
          fill="#FF0000"
          d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305z"
        />
        <path fill="#FFFFFF" d="M232.145 337.591V175.185l142.739 81.205z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg
        className={styles.logo}
        viewBox="0 0 448 512"
        aria-label="Instagram"
        role="img"
      >
        <defs>
          <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#FDC468" />
            <stop offset="0.4" stopColor="#DF4996" />
            <stop offset="1" stopColor="#515BD4" />
          </linearGradient>
        </defs>
        <path
          fill="url(#ig-grad)"
          d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"
        />
      </svg>
    );
  }
  // TikTok: the app tile — black rounded square, layered cyan/red/white note
  return (
    <svg
      className={styles.logo}
      viewBox="0 0 512 512"
      aria-label="TikTok"
      role="img"
    >
      <rect width="512" height="512" rx="110" fill="#000000" />
      <g transform="translate(80, 64) scale(0.72)">
        <path
          fill="#25F4EE"
          transform="translate(-18, -12)"
          d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"
        />
        <path
          fill="#FE2C55"
          transform="translate(18, 12)"
          d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"
        />
        <path
          fill="#FFFFFF"
          d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"
        />
      </g>
    </svg>
  );
}

function CreatorsDesktop() {
  const rootRef = useRef<HTMLElement>(null);

  // The wheel: cards ride a recycling track on a huge circle (nearly
  // vertical, aligned), and the card crossing the focal point unfolds to the
  // RIGHT into the wide stat card — its left edge never moves, the panel
  // slides out from behind the photo fully opaque.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wheel = root.querySelector<HTMLElement>("[data-wheel]");
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
    if (!wheel || !cards.length) return;
    const heading = root.querySelector<HTMLElement>(`.${styles.heading}`);
    const pitch = root.querySelector<HTMLElement>(`.${styles.pitch}`);
    const cta = root.querySelector<HTMLElement>(`.${styles.cta}`);
    const photos = cards.map((c) =>
      c.querySelector<HTMLElement>("[data-photo]"),
    );
    const strips = cards.map((c) =>
      c.querySelector<HTMLElement>("[data-strip]"),
    );
    const panels = cards.map((c) =>
      c.querySelector<HTMLElement>("[data-panel]"),
    );

    const N = cards.length;
    // spacing = R × SLOT, so the tighter circle needs a wider slot angle to
    // keep the same distance between neighbors
    const SLOT = 18; // degrees between neighbors on the recycling track
    const TRACK = N * SLOT; // a card leaving one end re-enters the other

    let R = 0;
    let cx = 0;
    let cy = 0;
    let cardH = 0;
    let compW = 0;
    let wideW = 0;
    let panelW = 0;
    // px the arc's focal point must travel to sit on the viewport centre.
    // Cached by measure(), never read per frame: reading a rect every tick
    // forces a synchronous layout for the life of the page (the Evan E3
    // lesson). Horizontal only — it does not change with scroll.
    let introDx = 0;

    const measure = () => {
      const W = wheel.offsetWidth;
      const H = wheel.offsetHeight;
      const phone = W < 700;
      cardH = H * (phone ? 0.3 : 0.3);
      compW = cardH * 0.82;
      const focalX = W * (phone ? 0.18 : 0.28); // where the unfold anchors
      // never let the unfolded card run past the right edge (left-anchored);
      // phone unfolds a touch wider so the panel text can breathe
      wideW = Math.min(
        cardH * (phone ? 2.3 : 2.05),
        W * (phone ? 0.98 : 0.96) - (focalX - compW / 2),
      );
      panelW = wideW - cardH; // the photo keeps a square's worth of card
      R = H * (phone ? 1.25 : 1.4); // smaller phone radius = tighter spacing
      cx = focalX - R;
      cy = H * 0.5;
      // The entrance scales about the arc's FOCAL POINT, not the box centre,
      // so scale/rotate cannot move it and the translate alone owns where it
      // sits. During the entrance no card is unfolded (see `unfold`), so the
      // focal card is compact and its centre IS focalX.
      wheel.style.transformOrigin = `${focalX.toFixed(1)}px ${cy.toFixed(1)}px`;
      // Measured off `root` (never transformed) + offsetLeft, a layout
      // metric — NOT off wheel.getBoundingClientRect(), which would already
      // contain the live entrance transform if a resize lands mid-flight.
      introDx =
        window.innerWidth / 2 -
        (root.getBoundingClientRect().left + wheel.offsetLeft + focalX);
      for (const p of panels) if (p) p.style.width = `${panelW}px`;
      // the photo is ALWAYS its full square — the compact card just clips
      // it, and unfolding reveals more of it. No re-cropping, no stretch.
      for (const ph of photos) if (ph) ph.style.width = `${cardH}px`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wheel);

    const state = { off: 0 };
    // Entrance only: holds the focal unfold shut through the whip. Seven
    // cards cross the ±10° unfold window inside one 1400ms spin, and each
    // would pulse from compact to fully-open with its stat panel sliding in
    // and out — a strobe. The phone reference forces `open = 0` for its whole
    // intro for exactly this reason. 1 at rest, so normal running is
    // untouched.
    let unfold = 1;
    const update = () => {
      for (let i = 0; i < N; i++) {
        const el = cards[i];
        // position on the recycling track, centered on the focal point
        let a = (i * SLOT + state.off) % TRACK;
        if (a < 0) a += TRACK;
        const th = a - TRACK / 2;
        if (Math.abs(th) > 45) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        const rad = (th * Math.PI) / 180;
        // focus ramps in over the last 10° — narrower than a slot, so only
        // the middle card ever morphs
        const fr = Math.max(0, 1 - Math.abs(th) / 10);
        const f = fr * fr * (3 - 2 * fr) * unfold; // smoothstep
        const w = compW + (wideW - compW) * f;
        el.style.width = `${w}px`;
        el.style.height = `${cardH}px`;
        el.style.zIndex = f > 0.01 ? "6" : "2";
        // left edge anchored — the card unfolds rightward like the mock;
        // translate before rotate, the same transform order as before
        const x = cx + R * Math.cos(rad) - compW / 2;
        const y = cy + R * Math.sin(rad) - cardH / 2;
        const rot = th * 0.8 * (1 - f); // straightens fully as it unfolds
        el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
        const strip = strips[i];
        if (strip) strip.style.opacity = String(Math.max(0, 1 - f * 2.5));
        const panel = panels[i];
        if (panel) {
          // slides in, opaque
          panel.style.transform = `translateX(${(1 - f) * panelW}px)`;
        }
      }
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const scrollDriven = Boolean(root.closest("[data-scroll-intro]"));

    // ── the entrance (owner: "an animation intro like this one but for the
    // desktop version where it spins with the arc already there but bigger
    // and in the middle then gets smaller to its original size and goes
    // right"). Same shape as the phone guide's opening spin, applied to the
    // WHEEL box rather than a drum: the arc is fully formed from the first
    // frame ("already there"), oversized with its focal point on the
    // viewport centre, spinning; the spin resolves first, then it shrinks,
    // untilts and travels home. Numbers are the phone carousel's, verbatim.
    const INTRO_MS = 1400; // = INTRO_SPIN
    const INTRO_SLOTS = 7; // = INTRO_FROM: seven creators whip past
    const INTRO_SCALE = 2.4; // starts oversized — deliberately clips
    const INTRO_ROT = -7; // deg of tilt it starts with, unwinds to 0
    let intro = false;
    let armed = false; // nothing runs until the entrance actually starts
    let triggered = false; // …and the trigger itself fires exactly once
    let introT0 = 0;
    let blankTimer = 0; // the white beat between the pin and the arc
    // the page is frozen while the arc spins in (owner) — released by the
    // entrance's own end, by holdScroll's deadline, or by unmount
    let releaseHold: (() => void) | null = null;
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const easeIntro = (t: number) => 1 - (1 - t) ** 4;
    // back.out(1.2): overshoots 1 then settles back. The owner asked for it
    // to "go right" at the end, but this arc's home is LEFT of the viewport
    // centre (measured at 1440: focal point 206px against a 720 centre), and
    // no transform-origin can swap the endpoints of a centre→home path — so
    // a rightward FINAL motion can only come from the path itself. It
    // overshoots ~5% (27px at 1440) then settles right over the last ~370ms.
    // The alternative reading — landing the arc on the RIGHT — would mean
    // mirroring a layout built entirely around a left arc (circle centre
    // off-screen left, focal card unfolding rightward, copy in column 2),
    // which is a redesign nobody asked for.
    const BACK_S = 1.2;
    const backOut = (t: number) =>
      1 + (BACK_S + 1) * (t - 1) ** 3 + BACK_S * (t - 1) ** 2;

    // The entrance must REVEAL an arc that is already oversized and already
    // mid-spin — painting the resting arc first and then ballooning it is a
    // teleport, and it is the same "shows up, disappears, animates in" bug
    // the Evan peel had. So park the wheel at the entrance's own t=0 state
    // here, before the first paint. `!reduced &&` short-circuits first: the
    // jsdom matchMedia stub reports reduced motion, so unit tests keep
    // today's static tree. Below 900px the layout differs (and 701–1023px is
    // behind the tablet block), so the geometry this assumes doesn't hold.
    const introOn =
      !scrollDriven &&
      !reduced &&
      window.matchMedia("(min-width: 900px)").matches;
    if (introOn || (scrollDriven && !reduced)) {
      root.classList.add(styles.isLive);
      state.off = INTRO_SLOTS * SLOT;
      unfold = 0;
      wheel.style.transform =
        `translateX(${introDx.toFixed(2)}px) scale(${INTRO_SCALE})` +
        ` rotate(${INTRO_ROT}deg)`;
    }
    update(); // park everything correctly (card 7 starts fully unfolded)

    // stepped cadence: glide one slot, then DWELL with the focal card fully
    // unfolded and dead level, then glide again — a self-driven rAF phase
    // machine looping forever. Each glide starts from wherever the last one
    // ended (the decrement compounds every cycle — a fixed target would
    // replay the SAME slot and the wheel would stick).
    const GLIDE = 750; // ms per slot
    const DWELL = 650; // ms paused at full extension
    let spinning = false;
    let started = false;
    let raf = 0;
    let phase: 0 | 1 = 0; // 0 = glide, 1 = dwell
    let phaseStart = 0;
    let glideFrom = 0; // state.off at the top of the current glide
    let lastTick = 0;
    let pausedAt = 0;
    let stopScrollIntro: (() => void) | undefined;
    let inView = false;

    const tick = (now: number) => {
      if (intro) {
        lastTick = now;
        const p = Math.min(1, (now - introT0) / INTRO_MS);
        // the spin finishes first (guide parity), the shrink trails it
        state.off = INTRO_SLOTS * SLOT * (1 - easeIntro(Math.min(1, p / 0.62)));
        const dz = clamp01((p - 0.28) / 0.72);
        const z = easeFn.inOut2(dz);
        const sc = INTRO_SCALE + (1 - INTRO_SCALE) * z;
        // the focal card opens as the arc settles, not during the whip
        unfold = clamp01((p - 0.72) / 0.28);
        wheel.style.transform =
          `translateX(${(introDx * (1 - backOut(dz))).toFixed(2)}px)` +
          ` scale(${sc.toFixed(4)}) rotate(${(INTRO_ROT * (1 - z)).toFixed(2)}deg)`;
        update();
        if (p >= 1) {
          // hand the cadence the state the entrance actually left behind, so
          // the first glide continues from here instead of jumping
          intro = false;
          unfold = 1;
          wheel.style.transform = "";
          state.off = 0;
          phase = 0;
          phaseStart = now;
          glideFrom = 0;
          releaseHold?.(); // the arc has landed — hand scrolling back
          releaseHold = null;
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      // lag smoothing: a long stall (backgrounded tab) shifts the clock
      // forward instead of fast-forwarding the wheel through missed slots
      if (now - lastTick > 500) phaseStart += now - lastTick - 33;
      lastTick = now;
      if (phase === 1 && now - phaseStart >= DWELL) {
        // dwell over — the next slot begins on this same frame
        phase = 0;
        phaseStart += DWELL;
        glideFrom = state.off;
      }
      if (phase === 0) {
        const t = Math.min(1, (now - phaseStart) / GLIDE);
        state.off = glideFrom - SLOT * easeFn.inOut2(t);
        if (t >= 1) {
          phase = 1;
          phaseStart += GLIDE;
        }
      }
      // render every tick, dwell included (the old timeline's onUpdate
      // fired through the empty dwell tween too) — so a mid-dwell resize
      // re-renders on the next frame instead of waiting for the next glide
      update();
      raf = requestAnimationFrame(tick);
    };

    const play = () => {
      // `armed` keeps the cadence from running before the entrance: the IO
      // fires as soon as the section is anywhere near the viewport, which
      // is long before the arc is meant to be seen at all.
      if (reduced || spinning || !armed) return; // reduced: never starts
      spinning = true;
      const now = performance.now();
      if (intro) {
        introT0 += now - pausedAt; // resume mid-entrance, no jump
      } else if (started) {
        phaseStart += now - pausedAt; // resume mid-phase, no jump
      } else {
        started = true;
        phaseStart = now;
        glideFrom = state.off;
      }
      lastTick = now;
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      if (!spinning) return;
      spinning = false;
      pausedAt = performance.now();
      cancelAnimationFrame(raf);
    };

    // The entrance fires when the section has actually taken the screen —
    // NOT on load, and not at the phone tree's 70% either: this section is
    // position:sticky at top 0 above 900px, so it sits at 70% while still
    // mostly below the fold. 25% is the moment it owns the viewport.
    //
    // …and then it WAITS. The page is held blank-white for BLANK_MS before
    // anything moves (owner: "transition page then play intro"), so the jack
    // lands on an empty sheet and the arc arrives onto it a beat later.
    // `armed` is what gates the running cadence, so it is set at the real
    // start, not at the trigger — otherwise the wheel would step through its
    // normal glide/dwell behind the parked opacity during the blank.
    const beginEntrance = () => {
      blankTimer = 0;
      armed = true;
      root.setAttribute("data-in", "1");
      introT0 = performance.now();
      intro = true;
      pausedAt = introT0;
      play();
    };
    const startIntro = () => {
      if (triggered) return;
      triggered = true;
      if (!introOn) {
        // nothing is parked in this case, so there is no blank to hold and
        // nothing to reveal — just let the cadence run
        armed = true;
        root.setAttribute("data-in", "1");
        play();
        return;
      }
      // The arc's own landing releases the hold (tick, p >= 1); this duration
      // is only the backstop for when that frame never comes — a backgrounded
      // tab suspends rAF, but the timeout still fires and frees the page.
      releaseHold = holdScroll(BLANK_MS + INTRO_MS + 400, root, () => {
        blankTimer = window.setTimeout(beginEntrance, BLANK_MS);
      });
    };
    // Fires at the PIN, not at the phone tree's 70% line. The section is
    // position:sticky/top:0 above 900px and the wheel is 100svh, so the
    // arc's vertical centre only coincides with the VIEWPORT centre once
    // the section has pinned — which is what collapses "in the middle" to a
    // pure horizontal translate. At 70% the whole entrance would play about
    // a viewport below the fold.
    const stopWatch = scrollDriven ? () => {} : onceInView(root, 5, startIntro);

    // spin only while the section is anywhere near the viewport (any
    // intersection at all — the old top/bottom-to-bottom/top window)
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (inView) play();
        else pause();
      }
    });
    io.observe(root);

    if (scrollDriven && !reduced) {
      stopScrollIntro = bindScrollIntro(root, (progress) => {
        const introProgress = smoothstep(0.02, 0.76, progress);
        const spinProgress = Math.min(1, introProgress / 0.62);
        const spinEase = 1 - (1 - spinProgress) ** 4;
        const settleProgress = clamp01((introProgress - 0.28) / 0.72);
        const settle = easeFn.inOut2(settleProgress);

        if (introProgress < 0.999) {
          pause();
          armed = false;
          started = false;
          state.off = INTRO_SLOTS * SLOT * (1 - spinEase);
          unfold = clamp01((introProgress - 0.72) / 0.28);
          const scale = INTRO_SCALE + (1 - INTRO_SCALE) * settle;
          wheel.style.transform =
            `translateX(${(introDx * (1 - settle)).toFixed(2)}px)` +
            ` scale(${scale.toFixed(4)}) rotate(${(
              INTRO_ROT * (1 - settle)
            ).toFixed(2)}deg)`;
          update();
        } else {
          state.off = 0;
          unfold = 1;
          wheel.style.transform = "";
          update();
          if (!armed) {
            armed = true;
            started = false;
            if (inView) play();
          }
        }

        const wheelReveal = smoothstep(0.01, 0.2, progress);
        wheel.style.opacity = wheelReveal.toFixed(4);
        const paintCopy = (
          element: HTMLElement | null,
          from: number,
          to: number,
        ) => {
          if (!element) return;
          const reveal = smoothstep(from, to, progress);
          element.style.opacity = reveal.toFixed(4);
          element.style.transform = `translate3d(0, ${(
            (1 - reveal) * 24
          ).toFixed(2)}px, 0)`;
        };
        paintCopy(heading, 0.22, 0.45);
        paintCopy(pitch, 0.34, 0.58);
        paintCopy(cta, 0.46, 0.7);
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      stopWatch();
      stopScrollIntro?.();
      io.disconnect();
      ro.disconnect();
      if (blankTimer) clearTimeout(blankTimer);
      releaseHold?.(); // a body left position:fixed freezes the whole site
      // never leave the arc parked, scaled, or mid-flight
      wheel.style.transform = "";
      wheel.style.removeProperty("opacity");
      wheel.style.transformOrigin = "";
      for (const element of [heading, pitch, cta]) {
        element?.style.removeProperty("opacity");
        element?.style.removeProperty("transform");
      }
      root.classList.remove(styles.isLive);
      root.removeAttribute("data-in");
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="creators">
      <div className={styles.copy}>
        <h2 className={styles.heading}>{COPY.headline}</h2>
        <p className={styles.pitch}>{COPY.pitch}</p>
        <a
          className={styles.cta}
          href={siteConfig.founderUrl}
          data-hover="primary"
        >
          {COPY.cta}
        </a>
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: no wheel element exists */}
      <div
        className={styles.wheel}
        data-wheel
        role="group"
        aria-label="Proovd creators"
      >
        {CREATORS.map((c) => (
          <article className={styles.card} data-card key={c.handle}>
            <img
              className={styles.photo}
              src={c.img}
              alt={`${c.niche} creator ${c.handle}`}
              width={454}
              height={470}
              decoding="async"
              loading="lazy"
              data-photo
            />
            {/* compact face: niche strip along the bottom */}
            <div
              className={styles.strip}
              data-strip
              style={{ background: c.bg, color: INK[c.fg] }}
            >
              <span className={styles.stripLabel}>Niche:</span>
              <span className={styles.stripNiche}>{c.niche}</span>
            </div>
            {/* focal face: slides out from the right edge as the card unfolds */}
            <div
              className={styles.panel}
              data-panel
              style={{ background: c.bg, color: INK[c.fg] }}
            >
              <span className={styles.handle}>{c.handle}</span>
              <div className={styles.statRow}>
                <PlatformLogo platform={c.platform} />
                <span className={styles.stat}>
                  <strong className={styles.followers}>{c.followers}</strong>
                  <span className={styles.followersLabel}>Followers</span>
                </span>
              </div>
              <div className={styles.nicheRow}>
                <span className={styles.stripLabel}>Niche:</span>
                <span className={styles.stripNiche}>{c.niche}</span>
              </div>
            </div>
          </article>
        ))}
        {/* white → 0 washes where cards enter and leave */}
        <div className={styles.fadeTop} aria-hidden="true" />
        <div className={styles.fadeBottom} aria-hidden="true" />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Phone carousel — a 1:1 port of the owner's animation/interaction guide
// ("proovd-section-carousel-mobile.html"): the creators ride a 3D drum.
// Side cards curve cylindrically (20 facets), turn away and shrink; the
// focused card is perfectly flat and, once the drum settles, auto-opens its
// stat panel (EXPAND → HOLD → COLLAPSE → advance). Drag/flick spins it with
// a spring; arrows step it; a click focuses a card. The entrance is an
// oversized tilted spin that unwinds while headline/pitch/CTA rise on the
// guide's cadence. The guide's numbers are kept verbatim; only the CONTENT
// differs — the site's own creators (photos, handles, counts, niches,
// per-card sheet colors, platform logos) ride the guide's presentation.
// ─────────────────────────────────────────────────────────────────────────

const SLICES = 20; // facets the curve is built from
const SLICE_KEYS = Array.from({ length: SLICES }, (_, k) => k);

// the curved layer is photo + niche bar only — always opaque, fixed width,
// so overlapping facets can never show a seam
function CardFace({ niche }: { niche: string }) {
  return (
    <span className={car.pic}>
      <span className={car.photo} />
      <span className={car.foot}>
        <i>Niche:</i>
        <b>{niche}</b>
      </span>
    </span>
  );
}

function CreatorsCarousel() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = root.querySelector<HTMLElement>("[data-stage]");
    const scene = root.querySelector<HTMLElement>("[data-scene]");
    const probe = root.querySelector<HTMLElement>("[data-probe]");
    const probePanel = root.querySelector<HTMLElement>("[data-probe-panel]");
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
    const headline = root.querySelector<HTMLElement>(`.${car.headline}`);
    const pitch = root.querySelector<HTMLElement>(`.${car.pitch}`);
    const ctaWrap = root.querySelector<HTMLElement>(`.${car.ctaWrap}`);
    const hint = root.querySelector<HTMLElement>(`.${car.hint}`);

    const cleanups: Array<() => void> = [];
    const on = (
      el: EventTarget,
      ev: string,
      fn: EventListenerOrEventListenerObject,
    ) => {
      el.addEventListener(ev, fn);
      cleanups.push(() => el.removeEventListener(ev, fn));
    };

    try {
      // both probes are gates, not optionals: without one, the engine would
      // silently ship a plausible-looking constant instead of the real width
      if (!stage || !scene || !probe || !probePanel || !cards.length) return;
      root.classList.add(car.isLive);

      const slicesOf = cards.map((c) =>
        Array.from(c.querySelectorAll<HTMLElement>("[data-slice]")),
      );
      const N = cards.length;

      // ── tunables — every number that shapes the curve, guide-verbatim ──
      const STEP_DEG = 30; // angle between neighbours around the drum
      const R_FACTOR = 1.0; // cylinder radius as a fraction of stage width
      const PERSP_F = 2.8; // perspective distance, also from stage width
      const ROT_DEG = 46; // how hard a side card turns away from centre
      const ROT_MAX = 78;
      const BEND_DEG = 58; // total curvature across a side card's surface
      const SIDE_SCALE = 0.62; // resting cards, relative to the focused one
      const LIFT = 52; // how far the focused card steps toward you
      const WAVE = 26; // ripple that travels the arc while it turns
      const SPRING = 195;
      const DAMPING = 25;
      const HOLD = 1700;
      const EXPAND = 400;
      const COLLAPSE = 290;
      const VISIBLE = 3;
      const DRAG_PX = 130; // pixels of drag per creator
      const INTRO_SPIN = 1400; // ms of opening sequence
      const INTRO_FROM = -7; // creators that whip past before it settles
      const INTRO_SCALE = 2.4; // starts oversized (clips off-screen)
      const INTRO_ROT = -7; // deg of tilt it starts with, unwinds to 0

      const scrollDriven = Boolean(root.closest("[data-scroll-intro]"));
      let intro = !scrollDriven;
      let introT = 0;
      // the page is frozen while the drum spins in (owner) — released when
      // the spin ends, when a finger takes it over, or on unmount
      let releaseHold: (() => void) | null = null;
      let pos = INTRO_FROM;
      let vel = 0;
      let target = 0;
      let hold = 0;
      let open = 0;
      let locked = false;
      let dragging = false;
      let dragFrom = 0;
      let dragX = 0;
      let lastX = 0;
      let lastT = 0;
      let moved = 0;
      let flick = 0;
      let PANELW = 170;
      let PHOTOW = 116;
      let BARH = 31;
      // cached in measure(), read by draw(): reading stage.clientWidth per
      // frame forced a synchronous style recalc + layout on EVERY rAF tick,
      // right after the frame wrote inline transforms to 7 cards and 140
      // facets — the exact regression recorded against the Evan peel
      let stageW = 0;
      let last = performance.now();
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const clampN = (v: number, a: number, b: number) =>
        v < a ? a : v > b ? b : v;
      const cubicOut = (x: number) => 1 - (1 - x) ** 3;
      const smooth = (x: number) => x * x * (3 - 2 * x);
      // shortest signed distance from pos to card i on a loop of N
      const offset = (i: number) => {
        let d = (i - pos) % N;
        if (d > N / 2) d -= N;
        if (d < -N / 2) d += N;
        return d;
      };

      const angCache: number[] = cards.map(() => -1);
      const flatCache: boolean[] = cards.map(() => false);

      const measure = () => {
        // Measured off a PROBE, never off a card's own panel. The guide read
        // cards[0]'s .panel-in, but draw() culls cards beyond VISIBLE with
        // display:none — and card 0 is culled by the very first draw() (it
        // starts at INTRO_FROM = -7). Every later measure() (i.e. every real
        // width change) therefore read 0 and fell back to the guide's
        // hardcoded 146px, while --panelw is clamp(130px, 39.4vw, 181px) —
        // 162px at 412 wide. .panelIn is anchored to the RIGHT inside a
        // .panel window of width --pw with overflow:hidden, so the shortfall
        // clipped the panel's LEFT edge: the platform logo and the "Niche:"
        // label were cut off, worse the wider the screen. Ceil, not round:
        // the window must never end up a sub-pixel narrower than the content
        // it reveals (a hair wider just shows the panel's own tint).
        //
        // Both reads keep the LAST GOOD value rather than degrading to a
        // constant. 146 and 116 are values --panelw/--photow never take at
        // any viewport, which is exactly why the original bug was invisible:
        // the wrong number looked plausible. On a resize the previous
        // measurement is always available and always closer than a guess.
        PANELW =
          Math.ceil(probePanel.getBoundingClientRect().width) || PANELW || 146;
        PHOTOW = probe.offsetWidth || PHOTOW || 116;
        // scoped to the section root — never the page root
        root.style.setProperty("--sw", `${(PHOTOW / SLICES).toFixed(4)}px`);
        angCache.fill(-1);
        BARH =
          Number.parseFloat(
            getComputedStyle(root).getPropertyValue("--barh"),
          ) || 31;
        stageW = stage.clientWidth;
        scene.style.setProperty(
          "--persp",
          `${Math.round(clampN(stageW * PERSP_F, 700, 1100))}px`,
        );
      };
      measure();

      const openAmount = (ms: number) => {
        if (ms < EXPAND) return cubicOut(ms / EXPAND);
        if (ms > HOLD - COLLAPSE) {
          return (
            1 - cubicOut(clampN((ms - (HOLD - COLLAPSE)) / COLLAPSE, 0, 1))
          );
        }
        return 1;
      };

      const easeIntro = (x: number) => 1 - (1 - x) ** 4;
      const endIntro = () => {
        intro = false;
        pos = 0;
        vel = 0;
        target = 0;
        hold = 0;
        locked = true;
        scene.style.transform = "";
        root.removeAttribute("data-intro");
        // reached both by the spin finishing and by a finger taking it over
        // mid-flight — either way the drum is the user's again, so is the page
        releaseHold?.();
        releaseHold = null;
      };

      const step = (dt: number) => {
        if (intro && !dragging) {
          introT += dt * 1000;
          const d = Math.min(1, introT / INTRO_SPIN);
          const dp = Math.min(1, d / 0.62); // the spin finishes first
          const dz = clampN((d - 0.28) / 0.72, 0, 1); // then shrink+straighten
          const prev = pos;
          pos = INTRO_FROM * (1 - easeIntro(dp));
          vel = dt > 0 ? (pos - prev) / dt : 0; // feeds the travelling ripple
          const z = dz < 0.5 ? 4 * dz ** 3 : 1 - (-2 * dz + 2) ** 3 / 2;
          const sc = INTRO_SCALE + (1 - INTRO_SCALE) * z;
          scene.style.transform = `scale(${sc.toFixed(4)}) rotate(${(
            INTRO_ROT * (1 - z)
          ).toFixed(2)}deg)`;
          open = 0;
          hold = 0;
          if (d >= 1) endIntro();
          return;
        }
        if (intro) endIntro(); // a touch during the intro takes over

        if (dragging) {
          locked = false;
        } else if (!locked) {
          const a = -SPRING * (pos - target) - DAMPING * vel; // spring home
          vel += a * dt;
          pos += vel * dt;
          // latch once it is near enough, so a hair of spring wobble can't
          // keep re-arming the hold timer
          if (Math.abs(pos - target) < 0.02 && Math.abs(vel) < 0.5) {
            locked = true;
            pos = target;
            vel = 0;
          }
        }

        if (locked && !dragging) {
          hold += dt * 1000;
          open = openAmount(hold);
          if (hold >= HOLD) {
            target += 1;
            hold = 0;
            locked = false;
          }
        } else {
          hold = 0;
          open *= 0.02 ** dt; // fold away quickly once it moves
        }
      };

      const draw = () => {
        const speed = clampN(vel / 5, -1, 1);
        const front = ((Math.round(pos) % N) + N) % N;
        const R = stageW * R_FACTOR; // cached — never read layout per frame
        const STEP = (STEP_DEG * Math.PI) / 180;

        for (let i = 0; i < N; i++) {
          const el = cards[i];
          const u = offset(i);
          const au = Math.abs(u);

          if (au > VISIBLE) {
            el.style.display = "none";
            continue;
          }
          el.style.display = "";

          const th = u * STEP;
          const amt = i === front ? open : 0;
          const near = smooth(clampN(1 - au, 0, 1));

          // a card sitting ON THE OUTSIDE of a slowly turning drum:
          // centre nearest, sides swinging away
          const x = Math.sin(th) * R;
          const z =
            (Math.cos(th) - 1) * R +
            amt * LIFT +
            speed * WAVE * Math.sin(u * 1.15);
          const ry =
            Math.sign(u) * Math.min(ROT_MAX, au * ROT_DEG) * (1 - near);
          const sc = SIDE_SCALE + (1 - SIDE_SCALE) * near;

          el.style.transform =
            `translate3d(${x.toFixed(1)}px,0px,${z.toFixed(1)}px)` +
            ` rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
          el.style.zIndex = String(1000 - Math.round(au * 10));

          // cylindrical warp: each facet steps a little further around the
          // curve. b is 0 dead centre, so the focused card is perfectly flat.
          const b = 1 - near;
          const W = PHOTOW;
          const ang = ((BEND_DEG * Math.PI) / 180) * b;
          const isFlat = ang < 0.01; // < 0.6deg across the whole card
          if (flatCache[i] !== isFlat) {
            flatCache[i] = isFlat;
            el.classList.toggle(car.isFlat, isFlat);
          }
          if (angCache[i] !== ang && !isFlat) {
            angCache[i] = ang;
            const flat = ang < 0.002;
            const Rb = flat ? 0 : W / ang;
            const sl = slicesOf[i];
            for (let k = 0; k < sl.length; k++) {
              const uk = (k + 0.5) / SLICES - 0.5;
              const phi = uk * ang;
              const sx = flat ? uk * W : Rb * Math.sin(phi);
              const sz = flat ? 0 : Rb * (Math.cos(phi) - 1);
              sl[k].style.transform =
                `translate3d(${sx.toFixed(2)}px,0,${sz.toFixed(2)}px)` +
                ` rotateY(${((phi * 180) / Math.PI).toFixed(2)}deg)`;
            }
          }

          el.style.setProperty("--pw", `${(amt * PANELW).toFixed(1)}px`);
          el.style.setProperty(
            "--po",
            clampN(amt * 1.7 - 0.7, 0, 1).toFixed(3),
          );
          el.style.setProperty("--fh", `${((1 - amt) * BARH).toFixed(1)}px`);
          el.style.pointerEvents = au < 2.2 ? "auto" : "none";
        }
      };

      let raf = 0;
      let running = false;
      let started = false; // the entrance has actually begun (gates play())
      let triggered = false; // …the trigger itself fires exactly once
      let blankTimer = 0; // the white beat between the pin and the spin
      let inView = false;
      const frame = (now: number) => {
        if (!running) return;
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        step(dt);
        draw();
      };
      const play = () => {
        if (running || reduced || !started) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      };
      const pause = () => {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
      };
      cleanups.push(pause);

      // arrival: the guide keys its cascade off page load; here it fires
      // when the section scrolls in — usually mid seam-jack (the Evan
      // magnet's phone end-guard glides the page onto this section, and the
      // 70% line crosses during that glide, so the spin plays as it lands).
      // …and then it WAITS: the page is held blank-white for BLANK_MS before
      // the drum moves (owner: "transition page then play intro"), so the
      // seam jack lands on an empty sheet and the spin arrives onto it. Same
      // shape as the desktop tree — `started` gates play(), so it is set at
      // the real start rather than at the trigger.
      const startIntro = () => {
        if (triggered) return;
        triggered = true;
        if (reduced) {
          started = true;
          root.setAttribute("data-in", "1");
          return;
        }
        // owner: "stop scrolling at the intro when the carousel spinning".
        // endIntro() is the real release; this duration is the backstop for
        // when its frame never comes (a backgrounded tab suspends rAF).
        releaseHold = holdScroll(BLANK_MS + INTRO_SPIN + 400, root, () => {
          blankTimer = window.setTimeout(() => {
            blankTimer = 0;
            started = true;
            root.setAttribute("data-in", "1");
            root.setAttribute("data-intro", "1");
            play();
          }, BLANK_MS);
        });
        cleanups.push(() => {
          if (blankTimer) clearTimeout(blankTimer);
          releaseHold?.();
        });
      };

      if (reduced) {
        // the guide's reduced state: drum settled, front card open, one paint
        intro = false;
        pos = 0;
        locked = true;
        open = 1;
        hold = EXPAND;
        started = true;
        root.setAttribute("data-in", "1");
        draw();
      } else if (scrollDriven) {
        draw();
        const stopScrollIntro = bindScrollIntro(root, (progress) => {
          const introProgress = smoothstep(0.02, 0.74, progress);
          const spinProgress = Math.min(1, introProgress / 0.62);
          const settleProgress = clampN((introProgress - 0.28) / 0.72, 0, 1);
          const spinEase = 1 - (1 - spinProgress) ** 4;
          const settle =
            settleProgress < 0.5
              ? 4 * settleProgress ** 3
              : 1 - (-2 * settleProgress + 2) ** 3 / 2;

          if (introProgress < 0.999) {
            pause();
            started = false;
            intro = false;
            pos = INTRO_FROM * (1 - spinEase);
            vel = 0;
            target = 0;
            locked = true;
            open = 0;
            hold = 0;
            const scale = INTRO_SCALE + (1 - INTRO_SCALE) * settle;
            scene.style.transform = `scale(${scale.toFixed(4)}) rotate(${(
              INTRO_ROT * (1 - settle)
            ).toFixed(2)}deg)`;
            root.setAttribute("data-intro", "1");
            draw();
          } else {
            root.removeAttribute("data-intro");
            scene.style.transform = "";
            pos = 0;
            vel = 0;
            target = 0;
            locked = true;
            open = 1;
            hold = EXPAND;
            draw();
            if (!started) {
              started = true;
              if (inView) play();
            }
          }

          const paintElement = (
            element: HTMLElement | null,
            from: number,
            to: number,
            distance = 18,
          ) => {
            if (!element) return;
            const reveal = smoothstep(from, to, progress);
            element.style.opacity = reveal.toFixed(4);
            element.style.transform = `translate3d(0, ${(
              (1 - reveal) * distance
            ).toFixed(2)}px, 0)`;
          };
          if (stage) {
            stage.style.opacity = smoothstep(0.01, 0.2, progress).toFixed(4);
          }
          paintElement(headline, 0.18, 0.42);
          paintElement(pitch, 0.3, 0.55);
          paintElement(ctaWrap, 0.43, 0.68);
          paintElement(hint, 0.6, 0.82, 0);
        });
        cleanups.push(() => {
          stopScrollIntro();
          scene.style.removeProperty("transform");
          root.removeAttribute("data-intro");
          for (const element of [stage, headline, pitch, ctaWrap, hint]) {
            element?.style.removeProperty("opacity");
            element?.style.removeProperty("transform");
          }
        });
      } else {
        draw(); // park the drum's first frame under the still-hidden stage
        cleanups.push(onceInView(root, 70, startIntro));
      }

      // spin only while the section is anywhere near the viewport
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          inView = entry.isIntersecting;
          if (inView) play();
          else pause();
        }
      });
      io.observe(root);
      cleanups.push(() => io.disconnect());

      // ── input: drag to spin, click to focus, arrows to step ──
      const onDown = (e: PointerEvent) => {
        dragging = true;
        moved = 0;
        flick = 0;
        dragFrom = pos;
        dragX = e.clientX;
        lastX = e.clientX;
        lastT = performance.now();
        vel = 0;
        hold = 0;
        stage.classList.add(car.dragging);
        try {
          stage.setPointerCapture(e.pointerId);
        } catch {
          /* capture is best-effort */
        }
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const now = performance.now();
        const dx = e.clientX - dragX;
        moved = Math.max(moved, Math.abs(dx));
        pos = dragFrom - dx / DRAG_PX;
        const dtm = Math.max(8, now - lastT) / 1000;
        flick = -((e.clientX - lastX) / DRAG_PX) / dtm;
        lastX = e.clientX;
        lastT = now;
      };
      const release = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        stage.classList.remove(car.dragging);
        if (stage.hasPointerCapture(e.pointerId)) {
          stage.releasePointerCapture(e.pointerId);
        }
        vel = clampN(flick, -14, 14);
        target = Math.round(pos + vel * 0.32); // a flick carries past a card
        locked = false;
      };
      on(stage, "pointerdown", onDown as EventListener);
      on(stage, "pointermove", onMove as EventListener);
      on(stage, "pointerup", release as EventListener);
      on(stage, "pointercancel", release as EventListener);

      const offsetTo = (i: number) => {
        let d = (i - Math.round(pos)) % N;
        if (d > N / 2) d -= N;
        if (d < -N / 2) d += N;
        return d;
      };
      const goTo = (i: number) => {
        target = Math.round(pos) + offsetTo(i);
        hold = 0;
        locked = false;
      };
      cards.forEach((el, i) => {
        on(el, "click", () => {
          if (moved < 6) goTo(i);
        });
        on(el, "focus", () => goTo(i));
      });
      on(stage, "keydown", ((e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          target = Math.round(pos) - 1;
          hold = 0;
          locked = false;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          target = Math.round(pos) + 1;
          hold = 0;
          locked = false;
        }
      }) as EventListener);

      // width-gated: mobile URL-bar collapses fire resize on every scroll
      // (the Evan lesson) — only a real width change re-measures the drum
      let lastW = window.innerWidth;
      on(window, "resize", () => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        measure();
        draw();
      });
      on(document, "visibilitychange", () => {
        if (!document.hidden) last = performance.now();
      });
    } catch {
      // §6.6 — a throwing motion layer must never hide the content; the
      // static no-JS state (copy + one flat card) stands back up
      root.classList.remove(car.isLive);
    }
    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return (
    <section ref={rootRef} className={car.root} id="creators">
      <div className={car.heroTop}>
        <h2 className={car.headline}>{COPY.headline}</h2>

        {/* biome-ignore lint/a11y/useSemanticElements: no drum element exists */}
        <div
          className={car.stage}
          data-stage
          role="group"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: drag+keys surface
          tabIndex={0}
          aria-label="Creator arc — swipe to spin, arrow keys to step"
        >
          <div className={car.scene} data-scene>
            {CREATORS.map((c) => (
              <button
                key={c.handle}
                type="button"
                className={car.card}
                data-card
                aria-label={`${c.handle}, ${c.followers} followers, ${c.niche}`}
                style={
                  {
                    "--tint": c.bg,
                    "--ontint": INK[c.fg],
                    "--img": `url("${c.img}")`,
                  } as React.CSSProperties
                }
              >
                <span className={car.bend}>
                  {SLICE_KEYS.map((k) => (
                    <span
                      key={k}
                      className={car.slice}
                      data-slice
                      style={{ "--k": k } as React.CSSProperties}
                    >
                      <CardFace niche={c.niche} />
                    </span>
                  ))}
                </span>
                <span className={car.flat}>
                  <CardFace niche={c.niche} />
                </span>
                {/* the text panel never bends (it only ever opens on the
                    flat centre card) */}
                <span className={car.panel}>
                  <span className={car.panelIn}>
                    <span className={car.handle}>{c.handle}</span>
                    <span className={car.stat}>
                      <span className={car.glyph}>
                        <PlatformLogo platform={c.platform} />
                      </span>
                      <span className={car.count}>
                        <b>{c.followers}</b>
                        <span>Followers</span>
                      </span>
                    </span>
                    <span className={car.rowniche}>
                      <i>Niche:</i>
                      <b>{c.niche}</b>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          {/* always-laid-out width probes — see measure() */}
          <i className={car.probe} data-probe aria-hidden="true" />
          <i className={car.probePanel} data-probe-panel aria-hidden="true" />
          <div className={`${car.fade} ${car.fadeL}`} aria-hidden="true" />
          <div className={`${car.fade} ${car.fadeR}`} aria-hidden="true" />
          <p className={car.hint}>Swipe to explore</p>
        </div>

        <p className={car.pitch}>{COPY.pitch}</p>
      </div>
      <div className={car.ctaWrap}>
        <a
          className={car.cta}
          href={siteConfig.founderUrl}
          data-hover="primary"
        >
          {COPY.cta}
        </a>
      </div>
    </section>
  );
}

// Posture gate — the same pattern as EvanSection: the phone treatment is a
// different SHAPE (the guide's drum carousel vs the desktop wheel), not a
// restyle, so it must be its own tree. SSR and the first client render are
// always "desktop" (matchMedia is unavailable on the server) so hydration
// matches; the effect then flips on a phone, and the component swap
// remounts, so each engine binds its own DOM through a normal mount.
export function CreatorsSection() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone ? <CreatorsCarousel /> : <CreatorsDesktop />;
}
