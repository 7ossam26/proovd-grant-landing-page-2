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
import { siteConfig } from "@/lib/site-config";
import styles from "./pricing-section.module.css";

const INCLUDES = [
  "Pitch refinement: voice note in, sellable pitch out",
  "1–5 vetted creators, matched to your niche",
  "Your campaign page, built and hosted for you",
  "Reserve-now, charge-later checkout via Stripe",
  "Tracked affiliate links with fraud protection",
  "Live analytics, plus backers’ survey answers",
  "Opt-in backer emails, yours to export",
];

export function PricingSection() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cancelIo: (() => void) | undefined;
    let split: WordSplit | null = null;
    const anims: Animation[] = [];

    const heading = root.querySelector<HTMLElement>("[data-heading]");
    const card = root.querySelector<HTMLElement>("[data-card]");
    const beta = root.querySelector<HTMLElement>("[data-beta]");
    const money = root.querySelector<HTMLElement>("[data-money]");
    const cta = root.querySelector<HTMLElement>("[data-cta]");
    const fine = root.querySelector<HTMLElement>("[data-fine]");
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-item]"));
    if (!heading || !card) return;

    const revealEls = [heading, card, beta, money, cta, fine, ...items].filter(
      (el): el is HTMLElement => !!el,
    );
    const clearInline = (el: HTMLElement) => {
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
      el.style.removeProperty("visibility");
    };

    const reveal = () => {
      if (cancelled) return;
      try {
        split = splitWords(heading);
        const words = split.words;
        // From-states paint now, not when the trigger fires (gsap.from's
        // immediateRender parity): everything holds hidden until then.
        for (const w of words) park(w, { transform: "translateY(130%)" });
        park(card, { opacity: 0, transform: "translateY(28px)" });
        for (const item of items) {
          park(item, { opacity: 0, transform: "translateY(14px)" });
        }
        if (cta) park(cta, { opacity: 0, transform: "translateY(16px)" });
        if (fine) park(fine, { opacity: 0, transform: "translateY(10px)" });
        if (beta) park(beta, { opacity: 0, transform: "scale(0)" });
        if (money) park(money, { opacity: 0, transform: "scale(0)" });

        // visibility:"hidden" rides each fading from-keyframe so
        // fill:"backwards" keeps the element unhoverable/unclickable through
        // its delay and flips it visible the instant its tween starts (CSS
        // visibility interpolation) — gsap autoAlpha parity. Without it the
        // transparent CTA is hover-active during its 0.75s delay, and a
        // hover mid-reveal would cancel the card's running reveal via playTo.
        cancelIo = onceInView(root, 60, () => {
          if (cancelled) return;
          try {
            for (const [i, w] of words.entries()) {
              anims.push(
                playFrom(
                  w,
                  { transform: "translateY(130%)" },
                  { duration: 0.5, delay: i * 0.05, ease: EASE.out4 },
                ),
              );
            }
            // Un-split once the last word lands, like SplitText's onComplete
            // revert did.
            anims[anims.length - 1]?.finished
              .then(() => {
                split?.revert();
                split = null;
              })
              .catch(() => {});
            anims.push(
              playFrom(
                card,
                {
                  opacity: 0,
                  transform: "translateY(28px)",
                  visibility: "hidden",
                },
                { duration: 0.5, delay: 0.2, ease: EASE.out3 },
              ),
            );
            for (const [i, item] of items.entries()) {
              anims.push(
                playFrom(
                  item,
                  {
                    opacity: 0,
                    transform: "translateY(14px)",
                    visibility: "hidden",
                  },
                  { duration: 0.35, delay: 0.45 + i * 0.06, ease: EASE.out3 },
                ),
              );
            }
            if (cta) {
              anims.push(
                playFrom(
                  cta,
                  {
                    opacity: 0,
                    transform: "translateY(16px)",
                    visibility: "hidden",
                  },
                  { duration: 0.35, delay: 0.75, ease: EASE.out3 },
                ),
              );
            }
            if (fine) {
              anims.push(
                playFrom(
                  fine,
                  {
                    opacity: 0,
                    transform: "translateY(10px)",
                    visibility: "hidden",
                  },
                  { duration: 0.3, delay: 0.85, ease: EASE.out3 },
                ),
              );
            }
            // the stickers slap on last
            if (beta) {
              anims.push(
                playFrom(
                  beta,
                  { opacity: 0, transform: "scale(0)", visibility: "hidden" },
                  { duration: 0.4, delay: 0.55, ease: EASE.backOut2 },
                ),
              );
            }
            if (money) {
              anims.push(
                playFrom(
                  money,
                  { opacity: 0, transform: "scale(0)", visibility: "hidden" },
                  { duration: 0.45, delay: 0.7, ease: EASE.backOut2 },
                ),
              );
            }
          } catch {
            // This callback fires async (IO), outside the try below — it
            // needs its own fail-open: motion must never leave content
            // hidden (§6.6). Cancelling parks nothing filled forwards, so
            // everything snaps to its natural, visible CSS state.
            for (const a of anims) a.cancel();
            split?.revert();
            split = null;
            for (const el of revealEls) clearInline(el);
          }
        });
      } catch {
        // Motion must never leave content hidden (§6.6).
        split?.revert();
        split = null;
        for (const el of revealEls) clearInline(el);
      }
    };

    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]).then(reveal);

    return () => {
      cancelled = true;
      cancelIo?.();
      for (const a of anims) a.cancel();
      split?.revert();
      split = null;
      for (const el of revealEls) clearInline(el);
    };
  }, []);

  // Hovering the CTA grows the WHOLE card with it — a full-width button
  // scaling on its own would break out of the card's border.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const card = root.querySelector<HTMLElement>("[data-card]");
    const cta = root.querySelector<HTMLElement>("[data-cta]");
    if (!card || !cta) return;

    const enter = () =>
      playTo(
        card,
        { transform: "scale(1.02)" },
        { duration: 0.15, ease: EASE.out2 },
      );
    const leave = () =>
      playTo(
        card,
        { transform: "scale(1)" },
        { duration: 0.2, ease: EASE.out2 },
      );
    cta.addEventListener("mouseenter", enter);
    cta.addEventListener("mouseleave", leave);
    return () => {
      cta.removeEventListener("mouseenter", enter);
      cta.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.section} id="pricing">
      <h2 className={styles.heading} data-heading>
        Pricing
      </h2>
      <div className={styles.card} data-card>
        <img
          className={styles.money}
          src="/assets/sticker-4.webp"
          alt=""
          aria-hidden="true"
          width={145}
          height={145}
          decoding="async"
          loading="lazy"
          data-money
        />
        <div className={styles.cardHead}>
          <p className={styles.plan}>Full Founder Campaign</p>
          <span className={styles.beta} data-beta>
            First 50 founders
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.priceRow}>
            <span className={styles.oldPrice}>$95</span>
            <span className={styles.price}>$25</span>
          </div>
          <div className={styles.divider} aria-hidden="true" />
          <p className={styles.includesLabel}>Includes:</p>
          <ul className={styles.list}>
            {INCLUDES.map((item) => (
              <li key={item} className={styles.item} data-item>
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <a className={styles.cta} href={siteConfig.founderUrl} data-cta>
            Start my campaign now
          </a>
          <p className={styles.fine} data-fine>
            Plus 5% of what you raise. Raise nothing, owe nothing.
          </p>
        </div>
      </div>
    </section>
  );
}
