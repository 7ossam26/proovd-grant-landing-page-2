"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef } from "react";
import { siteConfig } from "@/lib/site-config";
import { glideBusy, glideGate, glideTo, intentTick } from "./scroll-glide";
import styles from "./hero.module.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

const MOTION = {
  dur: { base: 0.35, headline: 0.65 },
  ease: { out: "power3.out", hero: "power4.out" },
  stagger: { words: 0.065 },
  dist: { enter: 16 },
};

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const cleanupFns: Array<() => void> = [];
    const ctx = gsap.context(() => {
      const headline = root.querySelector<HTMLElement>("[data-headline]");
      const logo = root.querySelector<HTMLElement>("[data-hero-logo]");
      const cta = root.querySelector<HTMLElement>("[data-cta]");
      if (!headline) return;

      gsap.set(headline, { autoAlpha: 0 });
      if (logo) gsap.set(logo, { autoAlpha: 0, y: -MOTION.dist.enter });
      if (cta) gsap.set(cta, { autoAlpha: 0, y: MOTION.dist.enter });

      const reveal = () => {
        if (cancelled) return;
        try {
          // One overlapping sequence, under a second total: logo drops in
          // right away, masked words rip through, the button lands with the
          // tail. Split reverted on complete (§6.4).
          const split = SplitText.create(headline, {
            type: "words",
            mask: "words",
          });
          gsap.set(headline, { autoAlpha: 1 });
          // Order: headline first (quick), then logo, then button.
          const tl = gsap.timeline();
          tl.from(
            split.words,
            {
              yPercent: 120,
              duration: 0.45,
              ease: "power4.out",
              stagger: 0.04,
              onComplete: () => split.revert(),
            },
            0,
          );
          if (logo) {
            tl.to(logo, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.65);
          }
          if (cta) {
            tl.to(cta, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.85);
          }
        } catch {
          // A failed motion layer must never leave hidden content (§6.6).
          gsap.set([headline, logo, cta], { autoAlpha: 1, y: 0 });
        }
      };

      // Commit the scroll the moment 15% of the hero is crossed — no waiting
      // for the scroll to settle (snap's built-in delay felt laggy). The
      // glide itself (input hold + landing settle) lives in the shared
      // scroll-glide module, so its tail can't trip the other helpers.
      const commit = (to: number, dir: 1 | -1) => {
        // Announce the glide home immediately so the navbar can exit in sync
        // instead of waiting for the scroll position to cross a line.
        if (to === 0) window.dispatchEvent(new CustomEvent("proovd:home"));
        glideTo(to, dir);
      };

      // Wheel is hijacked at the source: preventing the FIRST tick stops the
      // browser from starting its own smooth-scroll animation (a long fling
      // used to queue deltas that then fought the glide frame-by-frame).
      const onWheel = (e: WheelEvent) => {
        if (glideGate(e)) return; // glide in flight, or a landing's tail
        const y = window.scrollY;
        const heroH = root.offsetHeight;
        // in-region ticks are HELD and the glide commits on accumulated
        // intent — tiny trackpad deltas add up instead of drifting natively
        if (e.deltaY > 0 && y < heroH - 2) {
          e.preventDefault();
          if (intentTick(e)) commit(heroH, 1);
        } else if (e.deltaY < 0 && y > 0 && y <= heroH + 2) {
          e.preventDefault();
          if (intentTick(e)) commit(0, -1);
        }
      };
      window.addEventListener("wheel", onWheel, { passive: false });
      cleanupFns.push(() => window.removeEventListener("wheel", onWheel));

      // Scrollbar drags (no wheel events) still snap via ScrollTrigger —
      // desktop only. On touch, native CSS scroll-snap owns the glide
      // (a JS tween fighting touch momentum is what felt laggy on phones).
      if (window.matchMedia("(hover: hover)").matches) {
        ScrollTrigger.create({
          trigger: root,
          start: "top top",
          end: "bottom top",
          onUpdate: (self) => {
            if (glideBusy()) return;
            if (self.direction > 0 && self.progress > 0.15 && self.progress < 0.98) {
              commit(self.end, 1);
            } else if (self.direction < 0 && self.progress < 0.85 && self.progress > 0.02) {
              commit(self.start, -1);
            }
          },
        });
      }

      // Split only after Satoshi is ready — short backstop so the page never
      // sits idle waiting on the font (word-grain masks don't need line
      // measurement, so a late swap is harmless).
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]).then(reveal);
    }, root);

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
      ctx.revert();
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
