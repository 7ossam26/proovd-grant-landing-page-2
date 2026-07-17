"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef } from "react";
import { glideGate, glideTo, intentTick } from "./scroll-glide";
import styles from "./risk-section.module.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

const STICKERS = [
  { img: "/assets/sticker-1.webp", alt: "Shield sticker", cls: "stickerTopLeft", w: 285, h: 285 },
  { img: "/assets/sticker-4.webp", alt: "$$$ sticker", cls: "stickerTopRight", w: 145, h: 145 },
  { img: "/assets/sticker-3.webp", alt: "You're covered umbrella sticker", cls: "stickerBottomLeft", w: 335, h: 297 },
  { img: "/assets/sticker-2.webp", alt: "No risk sticker", cls: "stickerBottomRight", w: 288, h: 288 },
] as const;

// the guarantee stack — one line per way it can go sideways
const GUARANTEES = [
  {
    q: "No creators in your niche yet?",
    a: "Full refund, and you’re first in line when they join.",
  },
  {
    q: "Matched, but nobody opts in within 72 hours?",
    a: "You’re refunded everything above the $25 platform fee.",
  },
  {
    q: "Idea campaign misses its goal?",
    a: "Your backers pay nothing. And the clicks, drop-offs, and survey answers are yours to keep.",
  },
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
      const lines = root.querySelectorAll<HTMLElement>("[data-stack-line]");
      const kicker = root.querySelector<HTMLElement>("[data-kicker]");
      if (!title) return;

      const reveal = () => {
        if (cancelled) return;
        try {
          const split = SplitText.create(title, { type: "words", mask: "words" });
          const masks = split.words
            .map((w) => w.parentElement)
            .filter((p): p is HTMLElement => !!p && p !== title);
          gsap.set(masks, { paddingBottom: "0.18em", marginBottom: "-0.18em" });
          // the title owns the stage first: it rises in AT THE SECTION'S
          // CENTER, holds a beat, travels up to its resting spot, and only
          // then does everything else pile in around it
          const rootBox = root.getBoundingClientRect();
          const titleBox = title.getBoundingClientRect();
          const centerY =
            rootBox.top +
            rootBox.height / 2 -
            (titleBox.top + titleBox.height / 2);
          gsap.set(title, { y: centerY });
          // phone: while the title holds center stage the stickers cluster
          // in AROUND it — they spread back to their corners as it rises,
          // handing the room over to the copy
          if (window.matchMedia("(max-width: 700px)").matches) {
            const cx = rootBox.left + rootBox.width / 2;
            const cy = rootBox.top + rootBox.height / 2;
            stickers.forEach((s) => {
              const b = s.getBoundingClientRect();
              gsap.set(s, {
                x: (cx - (b.left + b.width / 2)) * 0.3,
                y: (cy - (b.top + b.height / 2)) * 0.6,
              });
            });
          }
          gsap
            .timeline({
              // fire only once the section has LANDED — mid-glide it played
              // while the section was still moving
              scrollTrigger: { trigger: root, start: "top 15%", once: true },
            })
            // "Risk Free" rises in, center stage, the stickers slapping on
            // around it (CSS `rotate` stays put — gsap only drives scale)
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
            .from(
              stickers,
              {
                scale: 0,
                autoAlpha: 0,
                duration: 0.35,
                ease: "back.out(2)",
                stagger: 0.06,
              },
              0,
            )
            // …then the title travels up to make room, the stickers
            // spreading back out to their corners with it…
            .to(title, { y: 0, duration: 0.55, ease: "power3.inOut" }, 0.75)
            .to(
              stickers,
              { x: 0, y: 0, duration: 0.55, ease: "power3.inOut" },
              0.75,
            )
            // …and the copy piles in underneath it
            .from(
              sub,
              { y: 16, autoAlpha: 0, duration: 0.3, ease: "power3.out" },
              1.1,
            )
            // the guarantee stack cascades in…
            .from(
              lines,
              {
                y: 14,
                autoAlpha: 0,
                duration: 0.3,
                ease: "power3.out",
                stagger: 0.06,
              },
              1.2,
            )
            // …and the kicker toast lands last, the kit's toast entrance:
            // up from below with a little overshoot
            .from(
              kicker,
              { y: 30, autoAlpha: 0, duration: 0.4, ease: "back.out(1.7)" },
              1.5,
            );
        } catch {
          // Motion must never leave content hidden (§6.6).
          gsap.set([title, sub, kicker, ...stickers, ...lines], {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
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
  // glides back. (The top boundary is owned by the creators helper.)
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
      // when the content overflows the viewport, the interior free-scrolls
      // first (the kicker has to be reachable) — the committed glide only
      // fires once the section's bottom is on screen
      const vh = window.innerHeight;
      const bottomStop = Math.max(top, top + H - vh);
      // in-region ticks are HELD (no native drift between stops) and the
      // glide commits once the stream reads as a real gesture — trackpads
      // deal tiny deltas, so single ticks accumulate instead of being ignored
      if (e.deltaY > 0) {
        if (y < bottomStop - 2) return; // still interior — native scroll
        if (y < top + H - 2) {
          e.preventDefault();
          if (intentTick(e)) glideTo(top + H, 1); // glide down to the next section
        }
      } else if (e.deltaY < 0 && y > top + H - 2 && y <= top + H + 2) {
        e.preventDefault();
        if (intentTick(e)) glideTo(bottomStop, -1); // back up to where you left
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="risk">
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
        Risk Free
      </h2>
      <p className={styles.sub} data-sub>
        Here’s exactly what happens if it doesn’t work out:
      </p>
      <ul className={styles.stack}>
        {GUARANTEES.map((g) => (
          <li key={g.q} className={styles.stackLine} data-stack-line>
            <strong className={styles.stackQ}>{g.q}</strong> {g.a}
          </li>
        ))}
      </ul>
      <p className={styles.kicker} data-kicker>
        The most an idea can cost you here: one listing fee and two weeks.
        Instead of months and thousands of dollars.
      </p>
    </section>
  );
}
