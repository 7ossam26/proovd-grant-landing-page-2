"use client";

import { useLayoutEffect, useRef } from "react";
import { EASE, holdScroll, onceInView, park, playFrom } from "@/lib/motion";
import styles from "./guides-section.module.css";

// The eight guides every founder gets — the deck the stack deals through.
const GUIDES = [
  {
    title: "Competition Guide",
    blurb: "Research competitors responsibly and cite sources.",
  },
  {
    title: "Branding Guide",
    blurb: "Build specific, non-generic brand direction.",
  },
  {
    title: "Visuals Guide",
    blurb: "Create consistent, credible campaign visuals.",
  },
  {
    title: "Story Guide",
    blurb: "Turn founder interviews into approved stories.",
  },
  {
    title: "Campaign Kit",
    blurb: "Guides Creators through campaign promotion.",
  },
  {
    title: "60-Second Opportunity Brief",
    blurb: "Summarizes campaign fit, risks, and compensation.",
  },
  {
    title: "Creator Readiness Checklist",
    blurb: "Confirms Creators can begin campaign work.",
  },
  {
    title: "Day 14 Evidence Guide",
    blurb: "Shows required progress and delivery evidence.",
  },
] as const;

// Card sheets — the creators section's placeholder combos, recycled (owner:
// "color combinations from the placeholders you have for the proovd color
// system of the cards"). The deck now sits on a BLACK panel and the dark
// sheets are gone (owner: "give the cards a black background and remove the
// darker cards") — they read as holes in it. Mint is back in play for the
// same reason: it was only skipped because it used to be the surface itself.
// Every sheet is light, so every card takes the system's dark-green ink.
const SHEETS = [
  "#D3F8C5",
  "#E9FFE1",
  "#D6F0FF",
  "#41ED98",
  "#F5FA9F",
  "#F2FF8B",
  "#EEF4EE",
  "#2FE58A",
];
const SHEET_INK = "#013F17";

export function GuidesSection() {
  const rootRef = useRef<HTMLElement>(null);

  // The bottom hinge, on its own clock (owner: "not on scroll make it a loop
  // animation"). Each card holds a beat, then falls FORWARD over its bottom
  // edge — the top tips toward you and swings down and around — handing the
  // stage to the card behind it. The deck recycles, so it runs for ever: a
  // card that has flipped away returns at the BACK of the stack and works its
  // way forward again. Position is a pure function of elapsed time, and the
  // rAF loop is parked whenever the section is off screen.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cards = Array.from(
      root.querySelectorAll<HTMLElement>("[data-guide-card]"),
    );
    const heading = root.querySelector<HTMLElement>("[data-guides-heading]");
    const sub = root.querySelector<HTMLElement>("[data-guides-sub]");
    const stack = root.querySelector<HTMLElement>("[data-guides-stack]");
    if (!cards.length) return;

    const N = cards.length;
    const HOLD = 1200; // ms a card owns the stage (owner: faster — was 2200)
    const FLIP = 560; // ms of the fall itself — enough to READ as a hinge
    const STEP = HOLD + FLIP;
    const HOLD_P = HOLD / STEP; // where in a step the fall begins
    // deg of fall. NEGATIVE = forward and down, over the hinge. A full 180
    // (was 132) with the fade held back to match (owner: "rotate them on the
    // hinge more") — the card used to start dimming at 59°, so barely a third
    // of the turn read as rotation. Now it goes all the way to edge-on.
    const SWING = -180;
    let raf = 0;
    let running = false;
    let t0 = 0;
    let pausedAt = 0;
    let cancelInView: (() => void) | undefined;
    let releaseHold: (() => void) | undefined;
    const anims: Animation[] = [];
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

    const clearCards = () => {
      cards.forEach((c, i) => {
        c.style.removeProperty("transform");
        c.style.removeProperty("opacity");
        c.style.removeProperty("visibility");
        // back to the static deal order the JSX ships — NOT removed, or a
        // fail-open would leave the deck stacked in reverse
        c.style.zIndex = String(N - i);
      });
    };
    // Motion must never leave content hidden (§6.6).
    const failOpen = () => {
      for (const a of anims) a.cancel();
      clearCards();
      heading?.removeAttribute("style");
      sub?.removeAttribute("style");
      stack?.removeAttribute("style");
      releaseHold?.();
    };

    // `p` is the deck's continuous position in CARDS: its whole part counts
    // the flips that have happened, its fraction is the current fall. Every
    // card's state is derived from it, so a dropped frame or a backgrounded
    // tab can never leave the deck in a half-state — the next frame simply
    // paints wherever the clock now says it is.
    const paint = (now: number) => {
      const k = (now - t0) / STEP;
      const idx = Math.floor(k);
      const frac = k - idx;
      const f0 = frac <= HOLD_P ? 0 : (frac - HOLD_P) / (1 - HOLD_P);
      const p = idx + f0;
      cards.forEach((el, i) => {
        // q = how far the deck has moved PAST this card, wrapped into one
        // lap. q < 1 → it is the front card, mid-fall. Otherwise it is
        // waiting its turn, `d` cards deep, counting down to the front.
        const q = (((p - i) % N) + N) % N;
        const front = q < 1;
        const f = front ? q : 0;
        const d = front ? 0 : N - q;
        if (d > 3.2) {
          // too deep to peek out from behind the stack — skip it entirely
          el.style.visibility = "hidden";
          return;
        }
        el.style.visibility = "visible";
        const fe = f * f * (3 - 2 * f); // smoothstep: gentle at both ends
        // NO per-card perspective() here — that was why the fall read as
        // "goes in front and disappears" instead of a hinge: transform-origin
        // applies to the whole transform chain, so a perspective() written in
        // the card's own transform put the VANISHING POINT at the hinge
        // itself, and the card just ballooned toward the viewer. The
        // perspective is now a property on `.stack`, whose origin sits at the
        // panel's centre — the card visibly forecloses and swings.
        el.style.transform =
          `translateY(${(-16 * d).toFixed(1)}px)` +
          ` scale(${(1 - d * 0.05).toFixed(4)})` +
          ` rotateX(${(fe * SWING).toFixed(2)}deg)`;
        // The face is gone just past edge-on, so the mirrored back never
        // shows (backface-visibility is the backstop). The band is 0.46–0.56
        // of the swing = 83°→101°: full opacity through the whole visible
        // turn, clearing exactly as the sheet goes side-on.
        el.style.opacity =
          fe > 0.46 ? clamp01(1 - (fe - 0.46) / 0.1).toFixed(3) : "1";
        // the front card must paint over the deck for its whole fall
        el.style.zIndex = String(front ? N + 1 : Math.round(N - d));
      });
    };
    const tick = (now: number) => {
      if (!running) return;
      paint(now);
      raf = requestAnimationFrame(tick);
    };
    const play = () => {
      if (running) return;
      running = true;
      const now = performance.now();
      // resume where it left off rather than jumping the deck forward by
      // however long the section spent off screen
      if (t0 === 0) t0 = now;
      else t0 += now - pausedAt;
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      if (!running) return;
      running = false;
      pausedAt = performance.now();
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // run the loop only while the section is anywhere near the viewport
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) play();
        else pause();
      }
    });

    try {
      // Everything is parked until the ARRIVAL (owner: "lets do a scroll
      // jack to the next and after its done scrolling animate in the
      // components then from there free scroll"): the trigger pins the page,
      // glides the section onto the viewport top, and only then do the copy
      // and the deck rise — heading, sub, panel, staggered. The hold
      // releases just after the last one lands, and scroll is free again.
      if (heading) park(heading, { opacity: 0, transform: "translateY(18px)" });
      if (sub) park(sub, { opacity: 0, transform: "translateY(16px)" });
      if (stack) park(stack, { opacity: 0, transform: "translateY(26px)" });
      cancelInView = onceInView(root, 72, () => {
        releaseHold = holdScroll(1000, root, () => {
          try {
            if (heading) {
              anims.push(
                playFrom(
                  heading,
                  { opacity: 0, transform: "translateY(18px)" },
                  { duration: 0.5, ease: EASE.out3 },
                ),
              );
            }
            if (sub) {
              anims.push(
                playFrom(
                  sub,
                  { opacity: 0, transform: "translateY(16px)" },
                  { duration: 0.5, delay: 0.12, ease: EASE.out3 },
                ),
              );
            }
            if (stack) {
              anims.push(
                playFrom(
                  stack,
                  { opacity: 0, transform: "translateY(26px)" },
                  { duration: 0.6, delay: 0.2, ease: EASE.out3 },
                ),
              );
            }
          } catch {
            failOpen();
          }
        });
      });

      paint(0); // park the deck's first frame before paint, card one standing
      io.observe(root);
    } catch {
      failOpen();
    }

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      cancelInView?.();
      releaseHold?.(); // a body left position:fixed freezes the whole site
      for (const a of anims) a.cancel();
      clearCards();
      heading?.removeAttribute("style");
      sub?.removeAttribute("style");
      stack?.removeAttribute("style");
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="guides">
      <div className={styles.stage}>
        <div className={styles.copy}>
          <h2 className={styles.heading} data-guides-heading>
            We want to see you make it…
          </h2>
          <p className={styles.sub} data-guides-sub>
            So we’re giving you the resources on the house
          </p>
        </div>
        <div className={styles.stack} data-guides-stack aria-hidden="false">
          {GUIDES.map((g, i) => (
            <article
              key={g.title}
              className={styles.card}
              // deal order: earlier cards paint on top, whatever the DOM
              // order would do — the engine only ever hides, never reorders
              style={{
                background: SHEETS[i % SHEETS.length],
                color: SHEET_INK,
                zIndex: GUIDES.length - i,
              }}
              data-guide-card
            >
              <h3 className={styles.cardTitle}>{g.title}</h3>
              <p className={styles.cardBlurb}>{g.blurb}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
