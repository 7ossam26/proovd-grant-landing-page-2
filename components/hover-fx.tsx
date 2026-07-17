"use client";

import gsap from "gsap";
import { useLayoutEffect } from "react";

/* Interaction recipes taken verbatim from the Proovd motion kit
   (proovd-motion.js), minus every color tween by request — elements keep
   their resting colors:
   - buttons (data-hover="primary"): the kit's primary-button hover — the
     variant swap's grow, scale 1 → 1.3 in 0.15s, back in 0.2s, power2.out —
     plus the kit's default press compress: scale 0.78 down in 0.12s
     (power2.out), release back in 0.25s (power3.out), pointer captured so
     the shrinking edge never swallows the click
   - links (data-hover="underline"): underline draw — scaleX 0 → 1 from the
     left on enter, collapses to the right on leave, 0.3s power3.out
     (currentColor hairline — no color shift)
   The underline's ::after scaffolding lives in styles/globals.css. */
export function HoverFX() {
  useLayoutEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cleanups: Array<() => void> = [];
    const on = (
      el: HTMLElement,
      ev: string,
      fn: EventListenerOrEventListenerObject,
    ) => {
      el.addEventListener(ev, fn);
      cleanups.push(() => el.removeEventListener(ev, fn));
    };

    document.querySelectorAll<HTMLElement>("[data-hover]").forEach((el) => {
      const kind = el.getAttribute("data-hover");

      if (kind === "primary") {
        on(el, "mouseenter", () =>
          gsap.to(el, { scale: 1.3, duration: 0.15, ease: "power2.out" }),
        );
        on(el, "mouseleave", () =>
          gsap.to(el, { scale: 1, duration: 0.2, ease: "power2.out" }),
        );
        const down = (e: Event) => {
          const pe = e as PointerEvent;
          try {
            el.setPointerCapture(pe.pointerId);
          } catch {
            /* capture is best-effort, per the kit */
          }
          gsap.to(el, { scale: 0.78, duration: 0.12, ease: "power2.out" });
        };
        const up = () =>
          gsap.to(el, { scale: 1, duration: 0.25, ease: "power3.out" });
        on(el, "pointerdown", down);
        on(el, "pointerup", up);
        on(el, "pointerleave", up);
        on(el, "pointercancel", up);
      }

      if (kind === "underline") {
        on(el, "mouseenter", () => {
          gsap.set(el, { "--uo": "left center" });
          gsap.to(el, { "--u": 1, duration: 0.3, ease: "power3.out" });
        });
        on(el, "mouseleave", () => {
          gsap.set(el, { "--uo": "right center" });
          gsap.to(el, { "--u": 0, duration: 0.3, ease: "power3.out" });
        });
      }
    });

    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
}
