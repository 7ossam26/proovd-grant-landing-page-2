"use client";

import { useLayoutEffect, useRef } from "react";
import {
  EASE,
  holdScroll,
  onceInView,
  park,
  playFrom,
  splitWords,
  type WordSplit,
} from "@/lib/motion";
import { siteConfig } from "@/lib/site-config";
import styles from "./days-section.module.css";

export function DaysSection() {
  const rootRef = useRef<HTMLElement>(null);

  // The Evan-mask entrance: the calendar image reveals through an expanding
  // window (the statement photo's recipe) while it settles from a slight
  // zoom; the headline then rips up through its word masks.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cancelInView: (() => void) | undefined;
    let cancelArrive: (() => void) | undefined;
    let releaseHold: (() => void) | undefined;
    let split: WordSplit | undefined;
    const anims: Animation[] = [];

    const mask = root.querySelector<HTMLElement>("[data-mask]");
    const bg = root.querySelector<HTMLElement>("[data-bg]");
    const title = root.querySelector<HTMLElement>("[data-title]");
    const sub = root.querySelector<HTMLElement>("[data-sub]");
    const cta = root.querySelector<HTMLElement>("[data-cta]");
    const cover = root.querySelector<HTMLElement>("[data-cover]");

    // ── the arrival: the pinhole reveal (owner: "a very tiny clip mask
    // square that grows until it shows the entire section underneath and
    // goes off screen"). The cover is a panel of the section's own surface —
    // continuous with the Risk panel above it, so scrolling toward this
    // section reads as more of the same dark ground — with a tiny square
    // hole cut in its middle (an evenodd polygon: outer ring = the panel,
    // inner ring = the hole). The arrival glides the section onto the
    // viewport top, then the hole grows past every edge and the cover is
    // gone. .isLive arms it; no-JS and reduced motion never see a cover.
    //
    // The copy's own entrance keys off position (onceInView below) and the
    // glide carries it across that line, so the words rip up through the
    // growing window — "whatever animation it has starts".
    const HOLE_SMALL =
      "polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%," +
      " 49.25% 49%, 49.25% 51%, 50.75% 51%, 50.75% 49%, 49.25% 49%)";
    const HOLE_FULL =
      "polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%," +
      " -10% -10%, -10% 110%, 110% 110%, 110% -10%, -10% -10%)";
    // The trigger sits at 90 (owner: "the clip grow should be from the middle
    // of the risk section not after scrolling down"): one wheel-notch past
    // Risk's resting view fires it — the glide sweeps the last of Risk off
    // across two identical dark surfaces (this cover IS the Risk panel's
    // colour, so the seam never shows) and the hole opens the moment it
    // lands, instead of waiting out a hand-scroll a third of the way into
    // the section.
    if (cover) {
      root.classList.add(styles.isLive);
      cancelArrive = onceInView(root, 90, () => {
        // 650ms grow, released 350ms after it lands (was 900/1250 — owner:
        // "the calendar section transition make it faster").
        releaseHold = holdScroll(1000, root, () => {
          if (cancelled) return;
          // (The synthetic `scroll` event that used to live here is gone with
          // the body pin: nothing freezes the page any more, so the navbar's
          // own passive listener is already seeing real scroll events.)
          try {
            const grow = cover.animate(
              [{ clipPath: HOLE_SMALL }, { clipPath: HOLE_FULL }],
              { duration: 650, easing: EASE.inOut3, fill: "forwards" },
            );
            anims.push(grow);
            grow.finished
              .then(() => {
                cover.style.display = "none";
              })
              .catch(() => {});
          } catch {
            // §6.6 — a cover that cannot animate must not stay covering
            cover.style.display = "none";
          }
        });
      });
    }

    const reveal = () => {
      if (cancelled || !mask || !bg || !title) return;
      try {
        split = splitWords(title);
        const { words } = split;
        // from()-style semantics: the hidden start states paint now, at
        // setup time, and hold until the scroll trigger releases them.
        for (const word of words) {
          park(word, { transform: "translateY(130%)" });
        }
        if (sub) park(sub, { transform: "translateY(16px)", opacity: 0 });
        if (cta) park(cta, { transform: "translateY(16px)", opacity: 0 });

        cancelInView = onceInView(root, 60, () => {
          const wordAnims = words.map((word, i) =>
            playFrom(
              word,
              { transform: "translateY(130%)" },
              { duration: 0.5, delay: i * 0.05, ease: EASE.out4 },
            ),
          );
          anims.push(...wordAnims);
          Promise.all(wordAnims.map((a) => a.finished))
            .then(() => split?.revert())
            .catch(() => {});
          if (sub) {
            anims.push(
              playFrom(
                sub,
                { transform: "translateY(16px)", opacity: 0 },
                { duration: 0.35, delay: 0.25, ease: EASE.out3 },
              ),
            );
          }
          if (cta) {
            anims.push(
              playFrom(
                cta,
                { transform: "translateY(16px)", opacity: 0 },
                { duration: 0.35, delay: 0.37, ease: EASE.out3 },
              ),
            );
          }
        });
      } catch {
        // Motion must never leave content hidden (§6.6).
        for (const a of anims) a.cancel();
        try {
          split?.revert();
        } catch {}
        for (const el of [mask, bg, title, sub, cta]) {
          el?.removeAttribute("style");
        }
      }
    };

    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]).then(reveal);

    return () => {
      cancelled = true;
      cancelInView?.();
      cancelArrive?.();
      releaseHold?.(); // a body left position:fixed freezes the whole site
      root.classList.remove(styles.isLive);
      cover?.style.removeProperty("display");
      for (const a of anims) a.cancel();
      try {
        split?.revert();
      } catch {}
      for (const el of [sub, cta]) {
        if (!el) continue;
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.removeProperty("visibility");
      }
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="days">
      <div className={styles.mask} data-mask aria-hidden="true">
        <div className={styles.bg} data-bg />
      </div>
      {/* the pinhole cover — the section's own surface with a tiny square
          hole; the arrival grows the hole past every edge (see the effect).
          Armed by .isLive; no-JS and reduced motion never see it. */}
      <div className={styles.cover} data-cover aria-hidden="true" />
      <div className={styles.copy}>
        <h2 className={styles.title} data-title>
          14 days
        </h2>
        <p className={styles.sub} data-sub>
          is all it takes for you to make money off of your idea and know people
          want it
        </p>
        <a
          className={styles.cta}
          href={siteConfig.founderUrl}
          data-cta
          data-hover="primary"
        >
          Start Campaign
        </a>
      </div>
    </section>
  );
}
