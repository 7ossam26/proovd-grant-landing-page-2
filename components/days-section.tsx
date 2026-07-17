"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef } from "react";
import { glideGate, glideTo, intentTick } from "./scroll-glide";
import styles from "./days-section.module.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

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
    const ctx = gsap.context(() => {
      const mask = root.querySelector<HTMLElement>("[data-mask]");
      const bg = root.querySelector<HTMLElement>("[data-bg]");
      const title = root.querySelector<HTMLElement>("[data-title]");
      const sub = root.querySelector<HTMLElement>("[data-sub]");
      const cta = root.querySelector<HTMLElement>("[data-cta]");
      if (!mask || !bg || !title) return;

      const reveal = () => {
        if (cancelled) return;
        try {
          const split = SplitText.create(title, { type: "words", mask: "words" });
          const masks = split.words
            .map((w) => w.parentElement)
            .filter((p): p is HTMLElement => !!p && p !== title);
          gsap.set(masks, { paddingBottom: "0.18em", marginBottom: "-0.18em" });
          gsap
            .timeline({
              scrollTrigger: { trigger: root, start: "top 60%", once: true },
            })
            .from(
              split.words,
              {
                yPercent: 130,
                duration: 0.5,
                ease: "power4.out",
                stagger: 0.05,
                onComplete: () => split.revert(),
              },
              0,
            )
            .from(sub, { y: 16, autoAlpha: 0, duration: 0.35, ease: "power3.out" }, 0.25)
            .from(cta, { y: 16, autoAlpha: 0, duration: 0.35, ease: "power3.out" }, 0.37);
        } catch {
          // Motion must never leave content hidden (§6.6).
          gsap.set([mask, bg, title, sub, cta], {
            clearProps: "all",
            autoAlpha: 1,
          });
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

  // Scroll help at this section's BOTTOM boundary, hero-style: a deliberate
  // tick down commits the glide to the next section, a tick up from there
  // glides back. (The top boundary is owned by the Risk helper.)
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!root.nextElementSibling) return; // last section — nothing below

    const onWheel = (e: WheelEvent) => {
      if (glideGate(e)) return; // glide in flight, or a landing's tail
      const top = root.offsetTop;
      const H = root.offsetHeight;
      const y = window.scrollY;
      if (y < top - 2) return; // above this section — not ours to steer
      // in-region ticks are HELD and the glide commits on accumulated
      // intent — tiny trackpad deltas add up instead of drifting natively
      if (e.deltaY > 0 && y < top + H - 2) {
        e.preventDefault();
        if (intentTick(e)) glideTo(top + H, 1); // glide down to the next section
      } else if (e.deltaY < 0 && y > top + 2 && y <= top + H + 2) {
        e.preventDefault();
        if (intentTick(e)) glideTo(top, -1); // glide back up to this section
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
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
          is all it takes for you to make money off of your idea and know
          people want it
        </p>
        <a
          className={styles.cta}
          href="#start"
          data-cta
          data-hover="primary"
        >
          Start Campaign
        </a>
      </div>
    </section>
  );
}
