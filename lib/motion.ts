// lib/motion.ts — the site's motion kit. GSAP was removed by request; these
// helpers reproduce the exact recipes the sections used (same durations,
// eases, staggers) on native primitives: the Web Animations API for tweens,
// IntersectionObserver for scroll-triggered reveals, and hand-rolled word
// masks in place of SplitText. Evan's scroll story keeps its own rAF engine.

/** CSS cubic-bezier equivalents of the GSAP eases the site used.
 *  GSAP powerN maps to the (N+1)-degree polynomial: power2 = cubic,
 *  power3 = quart, power4 = quint. back.out(s) grows y1 with the overshoot. */
export const EASE = {
  out1: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", // power1.out
  out2: "cubic-bezier(0.215, 0.61, 0.355, 1)", // power2.out
  out3: "cubic-bezier(0.165, 0.84, 0.44, 1)", // power3.out
  out4: "cubic-bezier(0.23, 1, 0.32, 1)", // power4.out
  in2: "cubic-bezier(0.55, 0.055, 0.675, 0.19)", // power2.in
  inOut2: "cubic-bezier(0.645, 0.045, 0.355, 1)", // power2.inOut
  inOut3: "cubic-bezier(0.77, 0, 0.175, 1)", // power3.inOut
  backOut17: "cubic-bezier(0.34, 1.56, 0.64, 1)", // back.out(1.7)
  backOut2: "cubic-bezier(0.34, 1.7, 0.64, 1)", // back.out(2)
  backOut3: "cubic-bezier(0.34, 2.2, 0.64, 1)", // back.out(3)
  backOut4: "cubic-bezier(0.34, 2.6, 0.64, 1)", // back.out(4)
} as const;

/** The same curves as plain functions, for rAF-driven loops. */
export const easeFn = {
  out2: (t: number) => 1 - (1 - t) ** 3,
  out3: (t: number) => 1 - (1 - t) ** 4,
  inOut2: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
} as const;

type TweenVars = {
  /** seconds, like the GSAP call it replaces */
  duration: number;
  /** seconds */
  delay?: number;
  /** a cubic-bezier string — use EASE.* */
  ease?: string;
};

const toMs = (v: TweenVars): KeyframeAnimationOptions => ({
  duration: v.duration * 1000,
  delay: (v.delay ?? 0) * 1000,
  easing: v.ease ?? "ease",
  fill: "backwards", // holds the from-state through the delay
});

const styleKeys = (frame: Keyframe): string[] =>
  Object.keys(frame).filter(
    (k) => k !== "offset" && k !== "easing" && k !== "composite",
  );

/** gsap.from(): play el FROM the given state TO its natural CSS state.
 *  Any inline styles parking the element in the from-state are cleared in
 *  the same tick (no flash — `fill: "backwards"` paints the from-state
 *  first), so the element lands on plain CSS with nothing left behind. */
export function playFrom(
  el: HTMLElement,
  from: Keyframe,
  vars: TweenVars,
): Animation {
  for (const k of styleKeys(from)) {
    el.style.removeProperty(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
  }
  el.style.removeProperty("visibility"); // autoAlpha parking
  return el.animate([{ ...from, offset: 0 }], toMs(vars));
}

/** gsap.to() + killTweensOf(): freeze any in-flight animation of the same
 *  properties at its current value, then play from there to `to`; the target
 *  values are written inline when the tween lands so the state persists. */
export function playTo(
  el: HTMLElement,
  to: Keyframe,
  vars: TweenVars,
): Animation {
  const keys = styleKeys(to);
  const running = el.getAnimations();
  if (running.length) {
    const computed = getComputedStyle(el);
    for (const k of keys) {
      el.style.setProperty(
        k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
        computed.getPropertyValue(
          k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
        ),
      );
    }
    for (const a of running) a.cancel();
  }
  const anim = el.animate([{ ...to, offset: 1 }], toMs(vars));
  anim.finished
    .then(() => {
      for (const k of keys) {
        const v = to[k as keyof Keyframe];
        el.style.setProperty(
          k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
          String(v),
        );
      }
      anim.cancel(); // the inline styles own the end state now
    })
    .catch(() => {
      /* cancelled mid-flight — the next tween froze the current value */
    });
  return anim;
}

/** Park an element hidden the way gsap.set(..., { autoAlpha: 0 }) did —
 *  inline, so the reveal (playFrom) can clear it. */
export function park(el: HTMLElement, frame: Keyframe): void {
  for (const k of styleKeys(frame)) {
    el.style.setProperty(
      k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      String(frame[k as keyof Keyframe]),
    );
  }
  if ("opacity" in frame && String(frame.opacity) === "0") {
    el.style.visibility = "hidden"; // autoAlpha semantics
  }
}

export type WordSplit = {
  /** the animatable inner spans, one per word */
  words: HTMLElement[];
  /** restore the original plain text */
  revert: () => void;
};

/** SplitText.create(el, { type: "words", mask: "words" }) parity: each word
 *  becomes an inline-block span inside an overflow-hidden mask span. The
 *  masks carry the house 0.18em descender allowance (padding cancelled by
 *  negative margin) so tight line-heights don't clip the rise. */
export function splitWords(el: HTMLElement): WordSplit {
  const text = el.textContent ?? "";
  const prevLabel = el.getAttribute("aria-label");
  el.setAttribute("aria-label", text.trim());
  const frag = document.createDocumentFragment();
  const words: HTMLElement[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      frag.appendChild(document.createTextNode(" "));
      continue;
    }
    const mask = document.createElement("span");
    mask.setAttribute("aria-hidden", "true");
    mask.style.cssText =
      "display:inline-block;overflow:hidden;vertical-align:top;" +
      "padding-bottom:0.18em;margin-bottom:-0.18em";
    const word = document.createElement("span");
    word.style.display = "inline-block";
    word.textContent = part;
    mask.appendChild(word);
    frag.appendChild(mask);
    words.push(word);
  }
  el.replaceChildren(frag);
  return {
    words,
    revert: () => {
      el.replaceChildren(document.createTextNode(text));
      if (prevLabel === null) el.removeAttribute("aria-label");
      else el.setAttribute("aria-label", prevLabel);
    },
  };
}

/* ── the arrival hold ──────────────────────────────────────────────────────
   One section-entrance scroll lock, shared by every section that owns a
   transition (creators' spin, risk's doors, days' clip reveal, the guides
   jack). Born in creators-section.tsx; the full history lives in CLAUDE.md.

   **The lock is a PINNED BODY, not preventDefault** — nothing lighter stops
   an iOS momentum fling. Same finding the Evan story's holdInput() rests on:
   once a finger lifts no touchmove fires, so there is nothing left to
   prevent, while a pinned body has no scroll range for the momentum to move.

   **And it pins IMMEDIATELY, then glides the page onto the section itself.**
   An earlier version waited for the scroll to go still before pinning so it
   could not freeze the Evan seam jack half-way — but that wait IS a
   slide-through: a trackpad flick covers most of a viewport inside it. So it
   takes the in-flight scroll over instead: pin on the spot, then animate
   `body.style.top` from wherever the page was to the section's own top
   (settleToTop()'s technique — while the body is pinned `scrollTo` does
   nothing, so the glide has to move the pin). A jack's remaining frames
   become no-ops and its SLIP check aborts it cleanly.

   `onSettled` fires when the page is not just held but LANDED — time the
   section's entrance from it. `ms` (the release backstop) runs from that
   same moment, not from the call.

   Returns a release fn. Callers MUST call it on unmount: a body left
   position:fixed freezes the whole site. */

// Distance-aware, on the Evan magnet's own advance ramp — triggers sit at
// different depths per section and posture, so a flat duration would be a
// gentle nudge on one and a snatch on another.
const holdGlideMs = (gap: number, h: number) =>
  200 + 260 * Math.min(1, gap / (0.62 * h));

export function holdScroll(
  ms: number,
  target: HTMLElement,
  onSettled?: () => void,
): () => void {
  let held = false;
  let lockedY = 0; // the virtual scroll while pinned; body.top === -lockedY
  let raf = 0;
  let timer = 0;

  const release = () => {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = 0;
    timer = 0;
    if (!held) return;
    held = false;
    const b = document.body.style;
    b.position = "";
    b.top = "";
    b.left = "";
    b.width = "";
    document.documentElement.style.overscrollBehavior = "";
    // unpin and restore in the SAME synchronous tick — coalesced into one
    // paint, so the scrollY-0 intermediate never shows (the Evan lesson)
    window.scrollTo(0, lockedY);
  };

  const settled = () => {
    timer = window.setTimeout(release, ms);
    onSettled?.();
  };

  // someone else already owns the page (the Evan statement's own hold, or a
  // neighbouring section's): stacking a second pin would read scrollY as 0
  // and restore the document top on release. Stand down — but the entrance
  // still gets its cue, or a one-off collision would cost it its opening.
  if (document.body.style.position !== "fixed") {
    held = true;
    lockedY = window.scrollY;
    // measured BEFORE the pin, though pinning moves nothing: body.top exactly
    // compensates the scroll it replaces
    const gap = target.getBoundingClientRect().top;
    const b = document.body.style;
    b.position = "fixed";
    b.top = `${-lockedY}px`;
    b.left = "0";
    b.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";
    // Only ever glide FORWARD onto the section. Arriving from below (scrolling
    // up out of the next section) puts its top above the viewport — gap < 0 —
    // and gliding then would drag the reader backwards through a section they
    // just left. Hold where they are instead.
    if (gap > 1) {
      const y0 = lockedY;
      const t0 = performance.now();
      const dur = holdGlideMs(gap, window.innerHeight);
      const step = (now: number) => {
        if (!held) return; // released mid-glide (unmount): stop writing
        const t = Math.min(1, (now - t0) / dur);
        lockedY = y0 + gap * easeFn.out2(t);
        document.body.style.top = `${-lockedY}px`;
        if (t < 1) {
          raf = requestAnimationFrame(step);
          return;
        }
        raf = 0;
        settled();
      };
      raf = requestAnimationFrame(step);
      return release;
    }
  }
  settled();
  return release;
}

/** ScrollTrigger { start: "top N%", once: true } parity: fire `cb` once when
 *  el's top crosses N% of the viewport height. Fires immediately if the page
 *  loads already past the line. Returns a cancel function. */
export function onceInView(
  el: Element,
  viewportPct: number,
  cb: () => void,
): () => void {
  if (
    el.getBoundingClientRect().top <=
    (window.innerHeight * viewportPct) / 100
  ) {
    cb();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.disconnect();
          cb();
          return;
        }
      }
    },
    { rootMargin: `0px 0px ${viewportPct - 100}% 0px` },
  );
  io.observe(el);
  return () => io.disconnect();
}
