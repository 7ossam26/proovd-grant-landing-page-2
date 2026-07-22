"use client";

import { useLayoutEffect } from "react";
import { easeFn } from "@/lib/motion";

/* Interaction recipes taken verbatim from the Proovd motion kit
   (proovd-motion.js), minus every color tween by request — elements keep
   their resting colors:
   - buttons (data-hover="primary"): the kit's primary-button hover — the
     variant swap's grow, scale 1 → 1.3 in 0.15s, back in 0.2s, power2.out —
     plus the kit's default press compress: scale 0.78 down in 0.12s
     (power2.out), release back in 0.25s (power3.out), pointer captured so
     the shrinking edge never swallows the click. The tween drives the
     independent CSS `scale` property, not `transform`: like gsap.to's
     per-property scale it composes with — and never cancels — concurrent
     animations (the hero/days CTA entrance reveals tween opacity/transform
     on these same elements), and it can never clobber a resting transform.
     Landing back on 1 clears the inline value, leaving no residue.
   - links (data-hover="underline"): underline draw — scaleX 0 → 1 from the
     left on enter, collapses to the right on leave, 0.3s power3.out
     (currentColor hairline — no color shift).
   Both ride the same rAF micro-tween (WAAPI can't animate the unregistered
   --u custom property, and for `scale` it would need getAnimations()
   bookkeeping that risks sweeping up foreign tweens). The underline's
   ::after scaffolding lives in styles/globals.css. */
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

    /* One live rAF id per element — each element only ever tweens one
       property (`scale` for primary, `--u` for underline), so starting a
       new tween cancels the old one and opposing directions never fight.
       Retargeting reads the last inline value, so a mid-flight pickup
       continues from wherever the previous tween left it (killTweensOf
       parity). */
    const rafIds = new WeakMap<HTMLElement, number>();
    const stopTween = (el: HTMLElement) => {
      const id = rafIds.get(el);
      if (id !== undefined) cancelAnimationFrame(id);
    };
    const tween = (
      el: HTMLElement,
      prop: "scale" | "--u",
      to: number,
      duration: number,
      ease: (t: number) => number,
    ) => {
      stopTween(el);
      const rest = prop === "scale" ? 1 : 0; // value when no inline is set
      const inline = Number.parseFloat(el.style.getPropertyValue(prop));
      const from = Number.isNaN(inline) ? rest : inline;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / (duration * 1000), 1);
        if (t < 1) {
          el.style.setProperty(prop, String(from + (to - from) * ease(t)));
          rafIds.set(el, requestAnimationFrame(step));
          return;
        }
        /* Landed. A scale back at its resting 1 clears the inline value so
           the element returns to pure CSS; --u stays inline like gsap.set
           left it (the stylesheet's own --u: 0 backstops it). */
        if (prop === "scale" && to === rest) el.style.removeProperty(prop);
        else el.style.setProperty(prop, String(to));
        rafIds.delete(el);
      };
      rafIds.set(el, requestAnimationFrame(step));
    };

    document.querySelectorAll<HTMLElement>("[data-hover]").forEach((el) => {
      const kind = el.getAttribute("data-hover");

      if (kind === "primary") {
        on(el, "mouseenter", () => tween(el, "scale", 1.3, 0.15, easeFn.out2));
        on(el, "mouseleave", () => tween(el, "scale", 1, 0.2, easeFn.out2));
        const down = (e: Event) => {
          const pe = e as PointerEvent;
          try {
            el.setPointerCapture(pe.pointerId);
          } catch {
            /* capture is best-effort, per the kit */
          }
          tween(el, "scale", 0.78, 0.12, easeFn.out2);
        };
        const up = () => tween(el, "scale", 1, 0.25, easeFn.out3);
        on(el, "pointerdown", down);
        on(el, "pointerup", up);
        on(el, "pointerleave", up);
        on(el, "pointercancel", up);
        cleanups.push(() => stopTween(el));
      }

      if (kind === "underline") {
        on(el, "mouseenter", () => {
          el.style.setProperty("--uo", "left center");
          tween(el, "--u", 1, 0.3, easeFn.out3);
        });
        on(el, "mouseleave", () => {
          el.style.setProperty("--uo", "right center");
          tween(el, "--u", 0, 0.3, easeFn.out3);
        });
        cleanups.push(() => stopTween(el));
      }
    });

    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
}
