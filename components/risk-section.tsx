"use client";

import { useLayoutEffect, useRef } from "react";
import { EASE, holdScroll, onceInView, park, playTo } from "@/lib/motion";
import styles from "./risk-section.module.css";

const STICKERS = [
  {
    img: "/assets/sticker-1.webp",
    alt: "Shield sticker",
    cls: "stickerTopLeft",
    w: 285,
    h: 285,
  },
  {
    img: "/assets/sticker-4.webp",
    alt: "$$$ sticker",
    cls: "stickerTopRight",
    w: 145,
    h: 145,
  },
  {
    img: "/assets/sticker-3.webp",
    alt: "You're covered umbrella sticker",
    cls: "stickerBottomLeft",
    w: 335,
    h: 297,
  },
  {
    img: "/assets/sticker-2.webp",
    alt: "No risk sticker",
    cls: "stickerBottomRight",
    w: 288,
    h: 288,
  },
] as const;

// The intro's sweep run — the whole sticker set rides through on a sine wave
// and leaves. Heights and gaps keep the reference's rhythm (big/small/big,
// gap 5/8/4/9…), which is what stops it reading as a conveyor belt. The
// owner re-exported the run as webp (`sticker-risksection-*`, ~500 KB total
// vs the PNGs' 8.8 MB); `sticker-1..4.webp` are the CORNER stickers, a
// different set — don't conflate the two.
const SWEEP = [
  { img: "/assets/sticker-risksection-1.webp", h: 1.2, gap: 5 },
  { img: "/assets/sticker-risksection-2.webp", h: 0.7, gap: 8 },
  { img: "/assets/sticker-risksection-3.webp", h: 1.05, gap: 4 },
  { img: "/assets/sticker-risksection-4.webp", h: 0.82, gap: 9 },
  { img: "/assets/sticker-risksection-5.webp", h: 1.25, gap: 5 },
  { img: "/assets/sticker-risksection-6.webp", h: 0.66, gap: 8 },
  { img: "/assets/sticker-risksection-7.webp", h: 1.0, gap: 4 },
  { img: "/assets/sticker-risksection-8.webp", h: 1.18, gap: 9 },
  { img: "/assets/sticker-risksection-9.webp", h: 0.74, gap: 5 },
  { img: "/assets/sticker-risksection-10.webp", h: 1.1, gap: 0 },
] as const;

// the headline, one flying unit per span
const WORDS = ["Faster,", "Cheaper,", "Less work"] as const;

// three points — no rules, no dividers; the space does the work
const POINTS = [
  {
    q: "Nothing to build, no ads to buy.",
    a: "Creators post it for a cut.",
  },
  {
    q: "Refunded if we can’t match you.",
    a: "You only pay if it runs.",
  },
  {
    q: "You keep the data either way:",
    a: "clicks, drop-offs, survey answers.",
  },
] as const;

const CARD = "$25 and two weeks to an answer. Not $10k and six months.";

// ── the intro's beats, in seconds (the reference's own numbers) ───────────
const LEAD = 0.05; // empty screen before anything moves (owner: the intro
// should fire right on the arrival — was 0.15)
const RUN = 2.4; // the sticker sweep
const FLIGHT = 0.6; // one word arriving
const LANDS = [0.4, 0.8, 1.2]; // when each word starts
const SETTLE_AT = 2.05; // the title contracts to resting size
const PT_AT = 2.7; // …and only then does the copy arrive
const PT_STEP = 0.08;
const CARD_AT = 3.05;
const BASE = 0.35;
const SLOW = 0.6;

const AMP = 0.19; // peak wave height, as a share of viewport height
const WAVE = 2.0; // wavelength, in viewport widths…
const WAVE_MIN = 1100; // …but never shorter than this, or a narrow screen
// crams a whole bow into a few hundred pixels
const TILT_MAX = 22; // degrees — caps how far anything rotates off level
const STEPS = 56; // keyframe stops sampled per element
const DOORS_MS = 750; // the two door panels parting

export function RiskSection() {
  const rootRef = useRef<HTMLElement>(null);

  // The intro, ported from the owner's reference: the sticker run sweeps in
  // from the right along a sine wave, the headline's words fly in one at a
  // time riding that same wave, the title contracts to its resting size, and
  // only then does the copy arrive. Every curve is SAMPLED into keyframes —
  // the wave is a position function, not an easing, so there is no timing
  // function that can express it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const title = root.querySelector<HTMLElement>("[data-title]");
    const strip = root.querySelector<HTMLElement>("[data-strip]");
    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-word]"));
    const sweeps = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sweep]"),
    );
    const stickers = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sticker]"),
    );
    const lines = Array.from(
      root.querySelectorAll<HTMLElement>("[data-stack-line]"),
    );
    const kicker = root.querySelector<HTMLElement>("[data-kicker]");
    if (!title || !strip || !words.length) return;

    let cancelled = false;
    let cancelInView: (() => void) | undefined;
    let cancelWarm: (() => void) | undefined;
    let releaseHold: (() => void) | undefined;
    const doors = Array.from(root.querySelectorAll<HTMLElement>("[data-door]"));
    const anims: Animation[] = [];
    const parked = [title, kicker, ...stickers, ...lines];

    // Motion must never leave content hidden (§6.6). The doors count as
    // hiding: dropping .isLive re-hides them through the stylesheet.
    const failOpen = () => {
      for (const a of anims) a.cancel();
      for (const el of parked) el?.removeAttribute("style");
      strip.style.visibility = "hidden";
      root.classList.remove(styles.isLive);
      releaseHold?.();
    };

    // one sampled ride: `a` is the wave's live amplitude, `px` the element's
    // position along it, so a thing that has travelled further sits further
    // along the same bow instead of carrying its own private wobble
    const play = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // The reference's beats now run at 3/4 time (owner: "make the stickers
      // faster") — ONE factor over the whole timeline, so the words still
      // ride the same wave instead of the run outpacing them. The mobile
      // scale stacks on top, exactly as before.
      const pace =
        (window.matchMedia("(max-width: 600px)").matches ? 0.85 : 1) * 0.75;
      const span = LEAD + RUN * pace;
      const lambda = Math.max(WAVE * vw, WAVE_MIN);
      const k = (2 * Math.PI) / lambda;
      const t = (s: number) => s * pace * 1000;

      const left = strip.getBoundingClientRect().left;
      const runW = strip.getBoundingClientRect().width;
      const centres = sweeps.map((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - left;
      });

      // the steepest point of a sine is amplitude × k, so cap the AMPLITUDE
      // rather than the angle — that keeps the curve a true sine instead of a
      // clipped one
      const peak = Math.min(AMP * vh, Math.tan((TILT_MAX * Math.PI) / 180) / k);
      const bendAt = (px: number, a: number) => ({
        y: a * Math.sin(k * px),
        r: Math.atan(a * k * Math.cos(k * px)) * (180 / Math.PI),
      });
      // Smoothstep in, and the wave swells and dies over the run.
      //
      // `x` is only the WAVE'S PHASE — where along the bow a sticker sits. The
      // strip's actual travel is written in PERCENT of its own width (see
      // `xOf`), not in the pixels measured here, and that distinction is the
      // fix for "on some screens the stickers do not fully get off screen,
      // especially on phone": the ten sweep PNGs are `loading="lazy"`, and an
      // <img> that has not loaded lays out at width 0 under `width: auto`.
      // Measured live at 390×844 with every `naturalWidth` still 0, the strip
      // read **222px** — the sum of its gaps alone — against a true width
      // several times that. A travel of `vw + 222` then left most of the run
      // standing on screen. A percent translate is resolved against the live
      // border box on every painted frame, so the end state clears whatever
      // the strip turns out to be, even if the artwork lands mid-run.
      const at = (u: number) => {
        const e = u * u * (3 - 2 * u);
        return { x: vw - (vw + runW) * e, a: peak * 4 * u * (1 - u) };
      };
      // 0 → the strip parked one viewport right; 1 → its right edge fully past
      // the left edge, plus PAD for the rotation overhang (a sticker turned
      // 22° paints wider than its layout box, so `-100%` alone can leave a
      // corner of the last one showing).
      const PAD = 8; // vw
      const xOf = (u: number) => {
        const e = u * u * (3 - 2 * u);
        return `calc(${(100 * (1 - e) - PAD * e).toFixed(2)}vw - ${(100 * e).toFixed(2)}%)`;
      };
      const offOf = (s: number) => Math.min(1, s / span);
      const hold = offOf(LEAD);
      const timing = (ms: number, delay = 0, easing = "linear") =>
        ({ duration: ms, delay, easing, fill: "both" }) as const;

      // ── the sticker run ──
      const slide: Keyframe[] = [
        { offset: 0, transform: `translate3d(${xOf(0)},0,0)` },
        { offset: hold, transform: `translate3d(${xOf(0)},0,0)` },
      ];
      for (let i = 1; i <= STEPS; i++) {
        const u = i / STEPS;
        slide.push({
          offset: offOf(LEAD + RUN * pace * u),
          transform: `translate3d(${xOf(u)},0,0)`,
        });
      }
      anims.push(strip.animate(slide, timing(span * 1000)));

      sweeps.forEach((el, i) => {
        const frames: Keyframe[] = [
          { offset: 0, transform: "translate3d(0,0,0) rotate(0deg)" },
          { offset: hold, transform: "translate3d(0,0,0) rotate(0deg)" },
        ];
        for (let s = 1; s <= STEPS; s++) {
          const u = s / STEPS;
          const { x, a } = at(u);
          const { y, r } = bendAt(centres[i] + x, a);
          frames.push({
            offset: offOf(LEAD + RUN * pace * u),
            transform: `translate3d(0,${y.toFixed(1)}px,0) rotate(${r.toFixed(2)}deg)`,
          });
        }
        anims.push(el.animate(frames, timing(span * 1000)));
      });

      // ── the words: a hero entrance, so power4.out, sampled onto the wave ──
      words.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const home = r.left + r.width / 2;
        const start = vw + r.width / 2 + 40;
        const frames: Keyframe[] = [];
        for (let s = 0; s <= STEPS; s++) {
          const u = s / STEPS;
          const e = 1 - (1 - u) ** 5; // power4.out
          const dx = (start - home) * (1 - e);
          const a = peak * (1 - u) ** 4; // its own speed, normalised
          const { y, r: rot } = bendAt(home + dx, a);
          frames.push({
            offset: u,
            transform: `translate3d(${dx.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg)`,
          });
        }
        anims.push(el.animate(frames, timing(t(FLIGHT), t(LEAD + LANDS[i]))));
      });

      // ── the title contracting onto its resting size ──
      const big = vw >= 900 ? 1.25 : 1.6;
      anims.push(
        title.animate(
          [{ transform: `scale(${big})` }, { transform: "scale(1)" }],
          timing(t(SLOW), t(SETTLE_AT), EASE.inOut2),
        ),
      );

      // ── the stickers take their corners as the room clears ──
      stickers.forEach((el, i) => {
        anims.push(
          el.animate(
            [
              { opacity: 0, transform: "scale(0)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            timing(t(BASE), t(PT_AT + i * 0.06), EASE.backOut2),
          ),
        );
      });

      // ── the copy, only once the title has finished settling ──
      const rise: Keyframe[] = [
        { opacity: 0, transform: "translateY(16px)" },
        { opacity: 1, transform: "none" },
      ];
      lines.forEach((el, i) => {
        anims.push(
          el.animate(rise, timing(t(BASE), t(PT_AT + i * PT_STEP), EASE.out3)),
        );
      });
      if (kicker) {
        anims.push(
          kicker.animate(rise, timing(t(BASE), t(CARD_AT), EASE.out3)),
        );
      }

      // every start state is now painted by an animation holding its first
      // keyframe, so the setup parks can come off without a flash
      for (const el of parked) el?.removeAttribute("style");
      strip.style.visibility = "visible";
    };

    try {
      // Arm the DOORS (owner: "from the creators to the risk section i want
      // Curtains: Doors"). .isLive turns their visibility on, so from the
      // first paint the section scrolls in as two closed white panels — the
      // creators surface, continued — and the arrival parts them. No-JS and
      // reduced motion never add the class, so they never see doors at all.
      root.classList.add(styles.isLive);

      // from()-style semantics: the hidden start states paint now, at setup
      // time, and hold until the scroll trigger releases them. The title is
      // parked whole — its words are off-screen right for the flight, and an
      // opacity park is what keeps them from showing before the trigger. This
      // runs synchronously in useLayoutEffect, so nothing can flash first.
      park(title, { opacity: 0 });
      for (const el of stickers) park(el, { opacity: 0 });
      for (const el of lines) park(el, { opacity: 0 });
      if (kicker) park(kicker, { opacity: 0 });

      // The run's webp set is lazy-loaded, so nothing fetches it until the
      // browser decides the section is close. START IT A VIEWPORT EARLY:
      // `decode()` is what kicks a parked lazy image. Without this the intro
      // reached its own trigger with every naturalWidth still 0 and sat on
      // the wait below — seconds of a section that looked dead ("I apparently
      // have to click to run the section"). Still nothing at page load: this
      // fires a viewport and a half down.
      cancelWarm = onceInView(root, 160, () => {
        for (const el of sweeps) {
          if (el instanceof HTMLImageElement) el.decode?.().catch(() => {});
        }
      });

      const startIntro = () => {
        // The wave's PHASE is measured off the strip's laid-out width, so the
        // artwork wants real dimensions before anything is sampled — an <img>
        // that has not loaded lays out at zero width under `width: auto`.
        // (Clearance no longer depends on this: the travel is written in
        // percent of the live box. This is the difference between a run whose
        // bow is bang on and one whose bow is a little out of phase.)
        //
        // So the cap is SHORT (600ms — was 1.2s; owner: the intro should
        // fire right after the arrival, and this wait is the only thing that
        // can hold it past the doors). With the warm-up above the images are
        // normally already there; when they are not, a slightly mis-phased
        // bow beats a section that does nothing.
        const loaded = sweeps.map((el) => {
          if (!(el instanceof HTMLImageElement) || el.naturalWidth > 0) {
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            const done = () => {
              el.removeEventListener("load", done);
              el.removeEventListener("error", done);
              resolve();
            };
            el.addEventListener("load", done);
            el.addEventListener("error", done);
            // decode() is what starts a lazy image that is still parked
            el.decode?.().then(done, () => {});
          });
        });
        Promise.race([
          Promise.all([document.fonts.ready, ...loaded]),
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]).then(() => {
          if (cancelled) return;
          try {
            play();
          } catch {
            failOpen();
          }
        });
      };

      // ── the arrival: Curtains-Doors (owner: "from the creators to the risk
      // section i want Curtains: Doors", then "the animation starts way too
      // late"). The trigger fires the moment the section has a real foothold
      // (15% of the viewport — was 28%, a whole extra wheel-notch of hand
      // scroll), holdScroll pins the page on the spot and glides it the rest
      // of the way — and the doors part FROM THE PIN, not from the landing:
      // inOut3 barely moves them through the ≤460ms glide, so the section has
      // effectively landed by the time they visibly open, and the dead beat
      // of blank white between trigger and landing is gone. The sweep
      // launches behind them on the same cue.
      cancelInView = onceInView(root, 85, () => {
        releaseHold = holdScroll(DOORS_MS + 350, root);
        try {
          for (const d of doors) {
            anims.push(
              playTo(
                d,
                {
                  transform: `translateX(${
                    d.dataset.door === "l" ? "-102%" : "102%"
                  })`,
                },
                { duration: DOORS_MS / 1000, ease: EASE.inOut3 },
              ),
            );
          }
          startIntro();
        } catch {
          failOpen();
        }
      });
    } catch {
      failOpen();
    }

    return () => {
      cancelled = true;
      cancelInView?.();
      cancelWarm?.();
      releaseHold?.(); // a body left position:fixed freezes the whole site
      root.classList.remove(styles.isLive);
      for (const a of anims) a.cancel();
      for (const el of parked) {
        if (!el) continue;
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.removeProperty("visibility");
      }
      strip.style.removeProperty("visibility");
      for (const d of doors) d.style.removeProperty("transform");
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="risk">
      {/* Curtains: Doors — two panels of the creators surface covering the
          section until the arrival parts them. Armed by .isLive (JS, motion
          on); no-JS and reduced motion never see them. */}
      <div className={styles.door} data-door="l" aria-hidden="true" />
      <div
        className={`${styles.door} ${styles.doorRight}`}
        data-door="r"
        aria-hidden="true"
      />
      {/* the intro's sweep — hidden until the run starts, gone once it ends */}
      <div className={styles.strip} data-strip aria-hidden="true">
        {SWEEP.map((s) => (
          <img
            key={s.img}
            className={styles.sweep}
            src={s.img}
            alt=""
            style={
              {
                "--h": s.h,
                "--gap": `${s.gap}vw`,
              } as React.CSSProperties
            }
            decoding="async"
            loading="lazy"
            data-sweep
          />
        ))}
      </div>
      {STICKERS.map((s) => (
        <img
          key={s.img}
          className={`${styles.sticker} ${styles[s.cls]}`}
          src={s.img}
          alt={s.alt}
          width={s.w}
          height={s.h}
          decoding="async"
          loading="lazy"
          data-sticker
        />
      ))}
      <h2 className={styles.title} data-title>
        <span className={styles.word} data-word>
          {WORDS[0]}
        </span>{" "}
        <span className={styles.word} data-word>
          {WORDS[1]}
        </span>
        <br />
        <span className={styles.word} data-word>
          {WORDS[2]}
        </span>
      </h2>
      <ul className={styles.stack}>
        {POINTS.map((p) => (
          <li key={p.q} className={styles.stackLine} data-stack-line>
            <strong className={styles.stackQ}>{p.q}</strong> {p.a}
          </li>
        ))}
      </ul>
      <p className={styles.kicker} data-kicker>
        {CARD}
      </p>
    </section>
  );
}
