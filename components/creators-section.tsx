"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";
import styles from "./creators-section.module.css";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

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
  { img: "/assets/Creator-1.webp", niche: "Lifestyle", handle: "@liv.days", followers: "96K", platform: "instagram", bg: "#86A28C", fg: "light" },
  { img: "/assets/Creator-2.webp", niche: "Streaming", handle: "@nova.plays", followers: "143K", platform: "tiktok", bg: "#D3F8C5", fg: "dark" },
  { img: "/assets/Creator-3.webp", niche: "Fitness", handle: "@formcheck", followers: "312K", platform: "youtube", bg: "#E9FFE1", fg: "dark" },
  { img: "/assets/Frame 4.webp", niche: "Music", handle: "@spinbackk", followers: "88K", platform: "tiktok", bg: "#D6F0FF", fg: "dark" },
  { img: "/assets/Creator-5.webp", niche: "Music", handle: "@miso.mixes", followers: "205K", platform: "instagram", bg: "#41ED98", fg: "dark" },
  { img: "/assets/Creator-6.webp", niche: "Fashion", handle: "@LM_styles", followers: "228K", platform: "tiktok", bg: "#F5FA9F", fg: "dark" },
  { img: "/assets/Creator-7.webp", niche: "Branding", handle: "@brandkid", followers: "74K", platform: "youtube", bg: "#013F17", fg: "light" },
  { img: "/assets/Creator-8.webp", niche: "Fashion", handle: "@inkandlenses", followers: "156K", platform: "instagram", bg: "#F2FF8B", fg: "dark" },
  { img: "/assets/Creator-9.webp", niche: "Design", handle: "@designbyrei", followers: "119K", platform: "tiktok", bg: "#86A28C", fg: "light" },
  { img: "/assets/Creator-10.webp", niche: "Lifestyle", handle: "@dailydose.d", followers: "182K", platform: "instagram", bg: "#012D10", fg: "light" },
  { img: "/assets/Creator-11.webp", niche: "Fitness", handle: "@repsbyluca", followers: "267K", platform: "youtube", bg: "#EEF4EE", fg: "dark" },
  { img: "/assets/Creator-12.webp", niche: "Streaming", handle: "@streamsz", followers: "331K", platform: "tiktok", bg: "#2FE58A", fg: "dark" },
];

const INK = { dark: "#013F17", light: "#E9FFE1" } as const;

// the platforms' own marks — TikTok as its app tile, YouTube's play,
// Instagram's gradient camera — not generic icons
function PlatformLogo({ platform }: { platform: Platform }) {
  if (platform === "youtube") {
    return (
      <svg className={styles.logo} viewBox="0 0 576 512" aria-label="YouTube" role="img">
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
      <svg className={styles.logo} viewBox="0 0 448 512" aria-label="Instagram" role="img">
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
    <svg className={styles.logo} viewBox="0 0 512 512" aria-label="TikTok" role="img">
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

export function CreatorsSection() {
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
    const photos = cards.map((c) => c.querySelector<HTMLElement>("[data-photo]"));
    const strips = cards.map((c) => c.querySelector<HTMLElement>("[data-strip]"));
    const panels = cards.map((c) => c.querySelector<HTMLElement>("[data-panel]"));

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

    const measure = () => {
      const W = wheel.offsetWidth;
      const H = wheel.offsetHeight;
      const phone = W < 700;
      cardH = H * (phone ? 0.3 : 0.3);
      compW = cardH * 0.82;
      const focalX = W * (phone ? 0.18 : 0.3); // where the unfold anchors
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
      for (const p of panels) if (p) p.style.width = `${panelW}px`;
      // the photo is ALWAYS its full square — the compact card just clips
      // it, and unfolding reveals more of it. No re-cropping, no stretch.
      for (const ph of photos) if (ph) ph.style.width = `${cardH}px`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wheel);

    const state = { off: 0 };
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
        const f = fr * fr * (3 - 2 * fr); // smoothstep
        const w = compW + (wideW - compW) * f;
        el.style.width = `${w}px`;
        el.style.height = `${cardH}px`;
        el.style.zIndex = f > 0.01 ? "6" : "2";
        gsap.set(el, {
          // left edge anchored — the card unfolds rightward like the mock
          x: cx + R * Math.cos(rad) - compW / 2,
          y: cy + R * Math.sin(rad) - cardH / 2,
          rotation: th * 0.8 * (1 - f), // straightens fully as it unfolds
        });
        const strip = strips[i];
        if (strip) strip.style.opacity = String(Math.max(0, 1 - f * 2.5));
        const panel = panels[i];
        if (panel) gsap.set(panel, { x: (1 - f) * panelW }); // slides in, opaque
      }
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    update(); // park everything correctly (card 7 starts fully unfolded)

    // stepped cadence: glide one slot, then DWELL with the focal card fully
    // unfolded and dead level, then glide again
    let spin: gsap.core.Timeline | null = null;
    if (!reduced) {
      spin = gsap
        // repeatRefresh recomputes the "-=" each cycle — without it every
        // repeat replays the SAME slot and the wheel sticks
        .timeline({ paused: true, repeat: -1, repeatRefresh: true, onUpdate: update })
        .to(state, { off: `-=${SLOT}`, duration: 0.75, ease: "power2.inOut" })
        .to({}, { duration: 0.65 }); // the pause at full extension
    }

    // spin only while the section is anywhere near the viewport
    const st = ScrollTrigger.create({
      trigger: root,
      start: "top bottom",
      end: "bottom top",
      onEnter: () => spin?.play(),
      onEnterBack: () => spin?.play(),
      onLeave: () => spin?.pause(),
      onLeaveBack: () => spin?.pause(),
    });

    return () => {
      spin?.kill();
      st.kill();
      ro.disconnect();
    };
  }, []);

  // Scroll help, hero-style: one deliberate wheel tick inside this section
  // commits the glide — down pulls the Risk curtain fully over, up pulls it
  // back open. Input is held during the glide; the fling that carried the
  // user here must die out before a tick can commit.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let committing = false;
    let wasIn = false;
    let tailAt = 0;
    const blockInput = (e: Event) => e.preventDefault();
    const holdInput = () => {
      window.addEventListener("wheel", blockInput, { passive: false });
      window.addEventListener("touchmove", blockInput, { passive: false });
    };
    const releaseInput = () => {
      window.removeEventListener("wheel", blockInput);
      window.removeEventListener("touchmove", blockInput);
      committing = false;
    };
    const commit = (to: number) => {
      committing = true;
      holdInput();
      gsap.to(window, {
        scrollTo: { y: to, autoKill: false },
        duration: 0.4,
        ease: "power2.inOut",
        overwrite: "auto",
        onComplete: releaseInput,
        onInterrupt: releaseInput,
      });
    };

    const onWheel = (e: WheelEvent) => {
      if (committing) {
        e.preventDefault();
        return;
      }
      const H = root.offsetHeight;
      // this section is sticky, so its own offsetTop follows the viewport
      // once stuck — anchor to the (non-sticky) neighbors instead
      const next = root.nextElementSibling as HTMLElement | null;
      const prev = root.previousElementSibling as HTMLElement | null;
      if (!next) return;
      const top = next.offsetTop - H;
      const y = window.scrollY;
      if (y < top - 2) {
        wasIn = false;
        return; // still above this section — not ours to steer
      }
      const now = performance.now();
      if (!wasIn) {
        wasIn = true;
        tailAt = now; // just arrived — the carry fling settles first
      }
      if (e.deltaY > 0 && y < top + H - 2) {
        e.preventDefault();
        if (now - tailAt < 160) {
          tailAt = now; // arrival momentum — hold the page still instead
          return;
        }
        commit(top + H); // pull the curtain over
      } else if (e.deltaY < 0 && y > top + 2 && y <= top + H + 2) {
        e.preventDefault();
        commit(top); // pull it back open
      } else if (e.deltaY < 0 && y >= top - 2 && prev) {
        e.preventDefault();
        commit(prev.offsetTop); // glide on up to the section above
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("wheel", blockInput);
      window.removeEventListener("touchmove", blockInput);
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="creators">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>You don&rsquo;t pay upfront for marketing</p>
        <h2 className={styles.heading}>
          Our creators pitch your idea to their followers and make commission
          when you earn
        </h2>
        <a className={styles.cta} href="#start" data-hover="primary">
          Start Campaign
        </a>
      </div>

      <div className={styles.wheel} data-wheel aria-label="Proovd creators">
        {CREATORS.map((c) => (
          <article className={styles.card} data-card key={c.handle}>
            <img
              className={styles.photo}
              src={c.img}
              alt={`${c.niche} creator ${c.handle}`}
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
