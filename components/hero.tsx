"use client";

import { useLayoutEffect, useRef } from "react";
import { EASE, park, playFrom, splitWords, type WordSplit } from "@/lib/motion";
import { siteConfig } from "@/lib/site-config";
import styles from "./hero.module.css";

const MOTION = {
  dur: { base: 0.35 },
  dist: { enter: 16 },
};

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const headline = root.querySelector<HTMLElement>("[data-headline]");
    const logo = root.querySelector<HTMLElement>("[data-hero-logo]");
    const cta = root.querySelector<HTMLElement>("[data-cta]");
    if (!headline) return;

    let cancelled = false;
    const anims: Animation[] = [];
    let split: WordSplit | null = null;

    // Fail-open reset: back to plain CSS — visible, un-transformed.
    const clearInline = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty("opacity");
      el.style.removeProperty("visibility");
      el.style.removeProperty("transform");
    };

    park(headline, { opacity: "0" });
    if (logo) {
      park(logo, {
        opacity: "0",
        transform: `translateY(-${MOTION.dist.enter}px)`,
      });
    }
    if (cta) {
      park(cta, {
        opacity: "0",
        transform: `translateY(${MOTION.dist.enter}px)`,
      });
    }

    const reveal = () => {
      if (cancelled) return;
      try {
        // One overlapping sequence, under a second total: logo drops in
        // right away, masked words rip through, the button lands with the
        // tail. Split reverted on complete (§6.4).
        split = splitWords(headline);
        // Un-park the headline so the mask spans show.
        headline.style.removeProperty("opacity");
        headline.style.removeProperty("visibility");
        // Order: headline first (quick), then logo, then button — the
        // 0.65/0.85 delays are the old timeline positions. The from-frames
        // carry visibility:hidden so fill:"backwards" keeps both elements
        // hidden AND inert through their delay (autoAlpha parity — CSS
        // visibility flips to visible only once the tween starts rendering).
        const wordAnims = split.words.map((word, i) =>
          playFrom(
            word,
            { transform: "translateY(120%)" },
            { duration: 0.45, delay: i * 0.04, ease: EASE.out4 },
          ),
        );
        anims.push(...wordAnims);
        Promise.all(wordAnims.map((a) => a.finished))
          .then(() => {
            split?.revert();
            split = null;
          })
          .catch(() => {});
        if (logo) {
          anims.push(
            playFrom(
              logo,
              {
                opacity: 0,
                visibility: "hidden",
                transform: `translateY(-${MOTION.dist.enter}px)`,
              },
              { duration: MOTION.dur.base, delay: 0.65, ease: EASE.out3 },
            ),
          );
        }
        if (cta) {
          anims.push(
            playFrom(
              cta,
              {
                opacity: 0,
                visibility: "hidden",
                transform: `translateY(${MOTION.dist.enter}px)`,
              },
              { duration: MOTION.dur.base, delay: 0.85, ease: EASE.out3 },
            ),
          );
        }
      } catch {
        // A failed motion layer must never leave hidden content (§6.6).
        clearInline(headline);
        clearInline(logo);
        clearInline(cta);
      }
    };

    // Split only after Satoshi is ready — short backstop so the page never
    // sits idle waiting on the font (word-grain masks don't need line
    // measurement, so a late swap is harmless).
    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]).then(reveal);

    return () => {
      cancelled = true;
      for (const a of anims) a.cancel();
      split?.revert();
      split = null;
      clearInline(headline);
      clearInline(logo);
      clearInline(cta);
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.hero} aria-label="Proovd">
      <div className={styles.bg} aria-hidden="true" />
      <img
        className={styles.logo}
        src="/assets/Proovd Logo.webp"
        alt="Proovd"
        width={909}
        height={274}
        decoding="async"
        fetchPriority="high"
        data-hero-logo
      />
      <h1 className={styles.headline} data-headline>
        Don’t go grey building the wrong thing.
      </h1>
      <a
        href={siteConfig.founderUrl}
        className={styles.start}
        data-cta
        data-hover="primary"
      >
        Start
      </a>
    </section>
  );
}
