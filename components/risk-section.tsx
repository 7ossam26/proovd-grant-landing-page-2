"use client";

import { useLayoutEffect, useRef } from "react";
import {
  EASE,
  onceInView,
  park,
  playFrom,
  playTo,
  splitWords,
  type WordSplit,
} from "@/lib/motion";
import styles from "./risk-section.module.css";

const STICKERS = [
  {
    img: "/assets/sticker-1.webp",
    alt: "Shield sticker",
    cls: "stickerTopLeft",
  },
  { img: "/assets/sticker-4.webp", alt: "$$$ sticker", cls: "stickerTopRight" },
  {
    img: "/assets/sticker-3.webp",
    alt: "You're covered umbrella sticker",
    cls: "stickerBottomLeft",
  },
  {
    img: "/assets/sticker-2.webp",
    alt: "No risk sticker",
    cls: "stickerBottomRight",
  },
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

  // The center-stage choreography: "Risk Free" rises at the section's dead
  // center while the stickers slap on around it, then everything travels to
  // its resting place and the copy piles in underneath.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const title = root.querySelector<HTMLElement>("[data-title]");
    const sub = root.querySelector<HTMLElement>("[data-sub]");
    const stickers = Array.from(
      root.querySelectorAll<HTMLElement>("[data-sticker]"),
    );
    const lines = Array.from(
      root.querySelectorAll<HTMLElement>("[data-stack-line]"),
    );
    const kicker = root.querySelector<HTMLElement>("[data-kicker]");
    if (!title) return;

    let cancelled = false;
    let cancelInView: (() => void) | undefined;
    let split: WordSplit | undefined;
    const anims: Animation[] = [];

    // Motion must never leave content hidden (§6.6).
    const failOpen = () => {
      for (const a of anims) a.cancel();
      try {
        split?.revert();
      } catch {}
      for (const el of [title, sub, kicker, ...stickers, ...lines]) {
        el?.removeAttribute("style");
      }
    };

    const reveal = () => {
      if (cancelled) return;
      try {
        split = splitWords(title);
        const { words } = split;
        // the title owns the stage first: it rises in AT THE SECTION'S
        // CENTER, holds a beat, travels up to its resting spot, and only
        // then does everything else pile in around it
        const rootBox = root.getBoundingClientRect();
        const titleBox = title.getBoundingClientRect();
        const centerY =
          rootBox.top +
          rootBox.height / 2 -
          (titleBox.top + titleBox.height / 2);
        park(title, { transform: `translateY(${centerY}px)` });
        // phone: while the title holds center stage the stickers cluster
        // in AROUND it — they spread back to their corners as it rises,
        // handing the room over to the copy
        const phone = window.matchMedia("(max-width: 700px)").matches;
        const cx = rootBox.left + rootBox.width / 2;
        const cy = rootBox.top + rootBox.height / 2;
        const cluster = stickers.map((s) => {
          if (!phone) return { x: 0, y: 0 };
          const b = s.getBoundingClientRect();
          return {
            x: (cx - (b.left + b.width / 2)) * 0.3,
            y: (cy - (b.top + b.height / 2)) * 0.6,
          };
        });
        // from()-style semantics: the hidden start states paint now, at
        // setup time, and hold until the scroll trigger releases them
        // (the stickers' CSS `rotate` is its own property — parking the
        // transform never touches it)
        for (const word of words) {
          park(word, { transform: "translateY(130%)" });
        }
        stickers.forEach((s, i) => {
          const { x, y } = cluster[i];
          park(s, {
            opacity: 0,
            transform: `translate(${x}px, ${y}px) scale(0)`,
          });
        });
        if (sub) park(sub, { opacity: 0, transform: "translateY(16px)" });
        for (const line of lines) {
          park(line, { opacity: 0, transform: "translateY(14px)" });
        }
        if (kicker) park(kicker, { opacity: 0, transform: "translateY(30px)" });

        // fire only once the section has LANDED — mid-glide it played
        // while the section was still moving
        cancelInView = onceInView(root, 15, () => {
          try {
            // "Risk Free" rises in, center stage (delays below are the old
            // timeline positions)
            const wordAnims = words.map((word, i) =>
              playFrom(
                word,
                { transform: "translateY(130%)" },
                { duration: 0.5, delay: i * 0.06, ease: EASE.out4 },
              ),
            );
            anims.push(...wordAnims);
            Promise.all(wordAnims.map((a) => a.finished))
              .then(() => split?.revert())
              .catch(() => {});
            // …then the title travels up to make room, the stickers
            // spreading back out to their corners with it. The travels are
            // created FIRST: playTo freezes-and-cancels whatever is already
            // animating on the element, and the slap-ons (below) must
            // survive that scan — timing-wise they're long done
            // (0.35 + 3 × 0.06 = 0.53s) before the travel leaves at 0.75s.
            anims.push(
              playTo(
                title,
                { transform: "translateY(0px)" },
                { duration: 0.55, delay: 0.75, ease: EASE.inOut3 },
              ),
            );
            for (const s of stickers) {
              anims.push(
                playTo(
                  s,
                  { transform: "translate(0px, 0px) scale(1)" },
                  { duration: 0.55, delay: 0.75, ease: EASE.inOut3 },
                ),
              );
            }
            // the stickers slap on around the centered title (CSS `rotate`
            // stays put — the tween only drives translate/scale). Their
            // stage-one target is the CLUSTER at full size, not the natural
            // corner state, so this is a raw two-keyframe tween.
            stickers.forEach((s, i) => {
              const { x, y } = cluster[i];
              const at = (sc: number) =>
                `translate(${x}px, ${y}px) scale(${sc})`;
              const pop = s.animate(
                [
                  { opacity: 0, transform: at(0) },
                  { opacity: 1, transform: at(1) },
                ],
                {
                  duration: 350,
                  delay: i * 60,
                  easing: EASE.backOut2,
                  fill: "backwards",
                },
              );
              // un-park opacity in the same tick; the transform park stays
              // (the keyframes override it while the pop plays, and it
              // guards against a flash before the finish handler lands)
              s.style.removeProperty("opacity");
              s.style.removeProperty("visibility");
              pop.finished
                .then(() => {
                  s.style.transform = at(1);
                  s.style.removeProperty("opacity");
                  s.style.removeProperty("visibility");
                })
                .catch(() => {});
              anims.push(pop);
            });
            // …and the copy piles in underneath it
            if (sub) {
              anims.push(
                playFrom(
                  sub,
                  { opacity: 0, transform: "translateY(16px)" },
                  { duration: 0.3, delay: 1.1, ease: EASE.out3 },
                ),
              );
            }
            // the guarantee stack cascades in…
            lines.forEach((line, i) => {
              anims.push(
                playFrom(
                  line,
                  { opacity: 0, transform: "translateY(14px)" },
                  { duration: 0.3, delay: 1.2 + i * 0.06, ease: EASE.out3 },
                ),
              );
            });
            // …and the kicker toast lands last, the kit's toast entrance:
            // up from below with a little overshoot
            if (kicker) {
              anims.push(
                playFrom(
                  kicker,
                  { opacity: 0, transform: "translateY(30px)" },
                  { duration: 0.4, delay: 1.5, ease: EASE.backOut17 },
                ),
              );
            }
          } catch {
            failOpen();
          }
        });
      } catch {
        failOpen();
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
      for (const el of [title, sub, kicker, ...stickers, ...lines]) {
        if (!el) continue;
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.removeProperty("visibility");
      }
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
