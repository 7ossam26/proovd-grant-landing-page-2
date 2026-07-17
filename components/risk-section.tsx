"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef } from "react";
import styles from "./risk-section.module.css";

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger, SplitText);

const STICKERS = [
  { img: "/assets/sticker-1.webp", alt: "Shield sticker", cls: "stickerTopLeft" },
  { img: "/assets/sticker-4.webp", alt: "$$$ sticker", cls: "stickerTopRight" },
  { img: "/assets/sticker-3.webp", alt: "You're covered umbrella sticker", cls: "stickerBottomLeft" },
  { img: "/assets/sticker-2.webp", alt: "No risk sticker", cls: "stickerBottomRight" },
] as const;

export function RiskSection() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const ctx = gsap.context(() => {
      const title = root.querySelector<HTMLElement>("[data-title]");
      const sub = root.querySelector<HTMLElement>("[data-sub]");
      const stickers = root.querySelectorAll<HTMLElement>("[data-sticker]");
      if (!title) return;

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
            // "Risk Free" gets the stage alone first…
            .from(
              split.words,
              {
                yPercent: 130,
                duration: 0.5,
                ease: "power4.out",
                stagger: 0.06,
                onComplete: () => split.revert(),
              },
              0,
            )
            // …takes a short beat, then everything else piles in quick
            .from(
              sub,
              { y: 16, autoAlpha: 0, duration: 0.3, ease: "power3.out" },
              0.75,
            )
            // stickers slap on one after another (CSS `rotate` stays put —
            // gsap only drives the scale)
            .from(
              stickers,
              {
                scale: 0,
                autoAlpha: 0,
                duration: 0.35,
                ease: "back.out(2)",
                stagger: 0.06,
              },
              0.8,
            );
        } catch {
          // Motion must never leave content hidden (§6.6).
          gsap.set([title, sub, ...stickers], { autoAlpha: 1, y: 0, scale: 1 });
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
  // glides back. (The top boundary is owned by the creators helper.)
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!root.nextElementSibling) return; // last section — nothing below

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
      const top = root.offsetTop;
      const H = root.offsetHeight;
      const y = window.scrollY;
      if (y < top - 2) {
        wasIn = false;
        return; // above this section — not ours to steer
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
        commit(top + H); // glide down to the next section
      } else if (e.deltaY < 0 && y > top + 2 && y <= top + H + 2) {
        e.preventDefault();
        commit(top); // glide back up to this section
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
    <section ref={rootRef} className={styles.section} id="risk">
      {STICKERS.map((s) => (
        <img
          key={s.img}
          className={`${styles.sticker} ${styles[s.cls]}`}
          src={s.img}
          alt={s.alt}
          data-sticker
        />
      ))}
      <h2 className={styles.title} data-title>
        Risk Free
      </h2>
      <p className={styles.sub} data-sub>
        No match, or your creator leaves? Full refund
      </p>
    </section>
  );
}
