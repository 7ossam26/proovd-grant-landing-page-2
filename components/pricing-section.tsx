"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef } from "react";
import styles from "./pricing-section.module.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

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
    const ctx = gsap.context(() => {
      const heading = root.querySelector<HTMLElement>("[data-heading]");
      const card = root.querySelector<HTMLElement>("[data-card]");
      const beta = root.querySelector<HTMLElement>("[data-beta]");
      const money = root.querySelector<HTMLElement>("[data-money]");
      const cta = root.querySelector<HTMLElement>("[data-cta]");
      const fine = root.querySelector<HTMLElement>("[data-fine]");
      const items = root.querySelectorAll<HTMLElement>("[data-item]");
      if (!heading || !card) return;

      const reveal = () => {
        if (cancelled) return;
        try {
          const split = SplitText.create(heading, { type: "words", mask: "words" });
          const masks = split.words
            .map((w) => w.parentElement)
            .filter((p): p is HTMLElement => !!p && p !== heading);
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
            .from(
              card,
              { y: 28, autoAlpha: 0, duration: 0.5, ease: "power3.out" },
              0.2,
            )
            .from(
              items,
              { y: 14, autoAlpha: 0, duration: 0.35, ease: "power3.out", stagger: 0.06 },
              0.45,
            )
            .from(
              cta,
              { y: 16, autoAlpha: 0, duration: 0.35, ease: "power3.out" },
              0.75,
            )
            .from(
              fine,
              { y: 10, autoAlpha: 0, duration: 0.3, ease: "power3.out" },
              0.85,
            )
            // the stickers slap on last
            .from(
              beta,
              { scale: 0, autoAlpha: 0, duration: 0.4, ease: "back.out(2)" },
              0.55,
            )
            .from(
              money,
              { scale: 0, autoAlpha: 0, duration: 0.45, ease: "back.out(2)" },
              0.7,
            );
        } catch {
          // Motion must never leave content hidden (§6.6).
          gsap.set([heading, card, beta, money, cta, fine, ...items], {
            autoAlpha: 1,
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

  // Hovering the CTA grows the WHOLE card with it — a full-width button
  // scaling on its own would break out of the card's border.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const card = root.querySelector<HTMLElement>("[data-card]");
    const cta = root.querySelector<HTMLElement>("[data-cta]");
    if (!card || !cta) return;

    const enter = () =>
      gsap.to(card, { scale: 1.02, duration: 0.15, ease: "power2.out" });
    const leave = () =>
      gsap.to(card, { scale: 1, duration: 0.2, ease: "power2.out" });
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
          <a className={styles.cta} href="#start" data-cta>
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
