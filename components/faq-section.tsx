"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef, useState } from "react";
import { FAQS } from "@/lib/faqs";
import styles from "./faq-section.module.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

export function FaqSection() {
  const rootRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  // No section transition — rows just rise in one by one as they scroll
  // into view, and the heading gets the house masked rise.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const ctx = gsap.context(() => {
      const heading = root.querySelector<HTMLElement>("[data-heading]");
      const items = root.querySelectorAll<HTMLElement>("[data-item]");
      if (!heading) return;

      const reveal = () => {
        if (cancelled) return;
        try {
          const split = SplitText.create(heading, { type: "words", mask: "words" });
          const masks = split.words
            .map((w) => w.parentElement)
            .filter((p): p is HTMLElement => !!p && p !== heading);
          gsap.set(masks, { paddingBottom: "0.18em", marginBottom: "-0.18em" });
          gsap.from(split.words, {
            yPercent: 130,
            duration: 0.5,
            ease: "power4.out",
            stagger: 0.05,
            onComplete: () => split.revert(),
            scrollTrigger: { trigger: heading, start: "top 80%", once: true },
          });
          for (const item of items) {
            gsap.from(item, {
              y: 16,
              autoAlpha: 0,
              duration: 0.4,
              ease: "power3.out",
              scrollTrigger: { trigger: item, start: "top 92%", once: true },
            });
          }
        } catch {
          // Motion must never leave content hidden (§6.6).
          gsap.set([heading, ...items], { autoAlpha: 1, y: 0 });
        }
      };

      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]).then(reveal);
    }, root);

    return () => {
      cancelled = true;
      ctx.revert();
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
