"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  EASE,
  onceInView,
  park,
  playFrom,
  splitWords,
  type WordSplit,
} from "@/lib/motion";
import styles from "./faq-section.module.css";

const FAQS = [
  {
    q: "When do backers actually pay?",
    a: "They don’t, at first. Cards are saved at reservation and charged only when your campaign hits its trigger: the pre-order goal for Pre-build, the close date for Pre-launch. No trigger, no charge, no refund drama.",
  },
  {
    q: "Do I need an audience?",
    a: "No. That’s what the creator is for: they bring the audience, you bring the thing worth backing.",
  },
  {
    q: "Who can list a campaign?",
    a: "US founders, 18+, selling something digital: apps, software, courses, creator tools. No physical products, no regulated categories like finance or medical for now.",
  },
  {
    q: "What does the creator earn?",
    a: "Commission on the sales their link drives: 30% base, more if they bid on a high-effort pitch or hit bonus milestones you set. It comes out of the raise, not your pocket.",
  },
  {
    q: "When do I get my money?",
    a: "Two parts. 40% is releasable three days after close, once admin confirms no red flags. The other 60% comes after your Day 14 progress check. Show real progress, get paid in full.",
  },
  {
    q: "Do I get to choose my affiliates?",
    a: "You’ll see 1–5 curated matches with their audience stats. Not feeling them? You can browse the network and request others manually. They opt in too: matching is mutual.",
  },
  {
    q: "What do affiliates actually see about my idea?",
    a: "Your full pitch: problem, solution, visuals, your interview. Worried about that? Apply for Teaser Mode. And every affiliate signed a 2-year IP agreement before they ever saw a pitch.",
  },
  {
    q: "Can I edit my campaign once it’s live?",
    a: "Freely, until the first reservation lands. After that, typos and FAQs only. Big changes mean cancel and relist.",
  },
  {
    q: "Can I cancel a campaign?",
    a: "First 2 days, no questions asked. After that, you’ll need admin approval and an actual reason. Cancel before close and nobody’s charged: saved cards just detach.",
  },
  {
    q: "What counts as “progress” at the Day 14 check?",
    a: "A demo link, repo walkthrough, beta invites. Proof you’re building, reviewed by a human. “The link loads” isn’t the bar.",
  },
  {
    q: "Can I pivot if backers fund something else?",
    a: "Iterate? Sure. Pivot to a different product? That’s a milestone fail, a ban, and backers get the unreleased money back. Sell what you pitched.",
  },
  {
    q: "Do I get my backers’ emails?",
    a: "Only from backers who opt in at checkout. Everyone else shows up as anonymous data. Still useful, just nameless.",
  },
  {
    q: "What’s this “high effort” label?",
    a: "It means you showed up with a napkin sketch. Affiliates can bid above the base commission to take it on: you can accept, reject, or counter. More polish, better rates.",
  },
  {
    q: "The AI rewrote my pitch. What if it’s wrong?",
    a: "You see it side-by-side with your original and nothing ships without your explicit sign-off. Your pitch, your responsibility.",
  },
  {
    q: "Sales come in organically, does the affiliate get a cut?",
    a: "Nope. Organic and SEO sales are 100% yours (minus our 5%). Affiliates only earn on their own links.",
  },
  {
    q: "Can I message affiliates directly?",
    a: "No DMs. Updates happen on your campaign page. Need a real conversation? There’s a 1-on-1 meeting request button.",
  },
  {
    q: "Can I run two campaigns at once?",
    a: "One at a time, 3-month gap between them. Quality over chaos.",
  },
  {
    q: "Who’s actually handling the money?",
    a: "Stripe. You’re the merchant of record, we’re the software. Nobody’s running a shoebox bank here.",
  },
  {
    q: "Back-to-back flops, am I banned?",
    a: "No. Failing is fine, that’s literally what validation is for. Ghosting after taking money is the only unforgivable sin.",
  },
];

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
