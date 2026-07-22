"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { FAQS } from "@/lib/faqs";
import {
  EASE,
  onceInView,
  park,
  playFrom,
  splitWords,
  type WordSplit,
} from "@/lib/motion";
import styles from "./faq-section.module.css";

export function FaqSection() {
  const rootRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  // No section transition — rows just rise in one by one as they scroll
  // into view, and the heading gets the house masked rise.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const heading = root.querySelector<HTMLElement>("[data-heading]");
    const items = root.querySelectorAll<HTMLElement>("[data-item]");
    if (!heading) return;

    let cancelled = false;
    let split: WordSplit | null = null;
    const anims: Animation[] = [];
    const cancels: (() => void)[] = [];
    const unpark = (el: HTMLElement) => {
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
      el.style.removeProperty("visibility");
    };

    const reveal = () => {
      if (cancelled) return;
      try {
        // splitWords already carries the 0.18em descender allowance on
        // its masks, so no extra padding fix is needed here.
        split = splitWords(heading);
        // from()-style tweens paint their hidden state at setup time,
        // not when the scroll line is crossed — park everything now.
        for (const word of split.words) {
          park(word, { transform: "translateY(130%)" });
        }
        for (const item of items) {
          park(item, { opacity: "0", transform: "translateY(16px)" });
        }
        cancels.push(
          onceInView(heading, 80, () => {
            const s = split;
            if (!s) return;
            const rises = s.words.map((word, i) =>
              playFrom(
                word,
                { transform: "translateY(130%)" },
                { duration: 0.5, delay: i * 0.05, ease: EASE.out4 },
              ),
            );
            anims.push(...rises);
            Promise.all(rises.map((a) => a.finished))
              .then(() => {
                s.revert();
                if (split === s) split = null;
              })
              .catch(() => {});
          }),
        );
        for (const item of items) {
          cancels.push(
            onceInView(item, 92, () => {
              anims.push(
                playFrom(
                  item,
                  { opacity: 0, transform: "translateY(16px)" },
                  { duration: 0.4, ease: EASE.out3 },
                ),
              );
            }),
          );
        }
      } catch {
        // Motion must never leave content hidden (§6.6).
        split?.revert();
        split = null;
        for (const item of items) unpark(item);
      }
    };

    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]).then(reveal);

    return () => {
      cancelled = true;
      for (const cancel of cancels) cancel();
      for (const anim of anims) anim.cancel();
      split?.revert();
      split = null;
      for (const item of items) unpark(item);
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="faq">
      <h2 className={styles.heading} data-heading>
        Founder FAQ
      </h2>
      <div className={styles.list}>
        {FAQS.map((f, i) => (
          <div key={f.q} className={styles.item} data-item>
            <button
              type="button"
              className={styles.question}
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span>{f.q}</span>
              <span
                className={`${styles.plus} ${open === i ? styles.plusOpen : ""}`}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            <div
              className={`${styles.answerWrap} ${open === i ? styles.answerOpen : ""}`}
            >
              <div className={styles.answerInner}>
                <p className={styles.answer}>{f.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
