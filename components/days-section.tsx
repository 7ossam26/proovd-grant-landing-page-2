"use client";

import { useLayoutEffect, useRef } from "react";
import {
  EASE,
  onceInView,
  park,
  playFrom,
  splitWords,
  type WordSplit,
} from "@/lib/motion";
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
    let split: WordSplit | undefined;
    const anims: Animation[] = [];

    const mask = root.querySelector<HTMLElement>("[data-mask]");
    const bg = root.querySelector<HTMLElement>("[data-bg]");
    const title = root.querySelector<HTMLElement>("[data-title]");
    const sub = root.querySelector<HTMLElement>("[data-sub]");
    const cta = root.querySelector<HTMLElement>("[data-cta]");

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
      <div className={styles.copy}>
        <h2 className={styles.title} data-title>
          14 days
        </h2>
        <p className={styles.sub} data-sub>
          is all it takes for you to make money off of your idea and know people
          want it
        </p>
        <a className={styles.cta} href="#start" data-cta data-hover="primary">
          Start Campaign
        </a>
      </div>
    </section>
  );
}
