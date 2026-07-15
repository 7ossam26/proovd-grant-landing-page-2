"use client";

import gsap from "gsap";
import { useLayoutEffect } from "react";

/* Button hover recipes lifted from the Proovd motion kit (proovd-motion.js):
   - sweep: brand fill sweeps in L→R behind the label after a ~0.1s intent
     delay (grazing past never flashes), reverses R→L on leave
   - primary: subtle grow (1.02) with the fill deepening a step
   - underline: draws in from the left, collapses out to the right
   Elements opt in via data-hover; data-hover-text sets the sweep's hover
   ink. The CSS var scaffolding lives in styles/globals.css. */
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

      if (kind === "sweep") {
        const restText = getComputedStyle(el).color;
        const hoverText = el.getAttribute("data-hover-text");
        let enterTl: gsap.core.Timeline | null = null;
        on(el, "mouseenter", () => {
          enterTl?.kill();
          gsap.set(el, { backgroundPosition: "left center" });
          enterTl = gsap
            .timeline({ delay: 0.1 }) // intent delay, per the kit
            .to(el, { "--sweep": 1, duration: 0.3, ease: "power2.out" }, 0);
          if (hoverText) {
            enterTl.to(el, { color: hoverText, duration: 0.3, ease: "power2.out" }, 0);
          }
        });
        on(el, "mouseleave", () => {
          enterTl?.kill();
          enterTl = null;
          gsap.set(el, { backgroundPosition: "right center" });
          gsap.to(el, { "--sweep": 0, duration: 0.3, ease: "power2.out" });
          if (hoverText) {
            gsap.to(el, { color: restText, duration: 0.3, ease: "power2.out" });
          }
        });
      }

      if (kind === "primary") {
        const restBg = getComputedStyle(el).backgroundColor;
        on(el, "mouseenter", () =>
          gsap.to(el, {
            scale: 1.02,
            backgroundColor: "#2FE58A",
            duration: 0.15,
            ease: "power2.out",
          }),
        );
        on(el, "mouseleave", () =>
          gsap.to(el, {
            scale: 1,
            backgroundColor: restBg,
            duration: 0.2,
            ease: "power2.out",
          }),
        );
      }

      if (kind === "underline") {
        on(el, "mouseenter", () => {
          gsap.set(el, { backgroundPosition: "left calc(100% - 0.05em)" });
          gsap.to(el, { "--u": 1, duration: 0.3, ease: "power3.out" });
        });
        on(el, "mouseleave", () => {
          gsap.set(el, { backgroundPosition: "right calc(100% - 0.05em)" });
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
