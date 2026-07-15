"use client";

import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./navbar.module.css";

gsap.registerPlugin(ScrollTrigger, Flip);

export function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const toggleMenu = () => {
    const panel = panelRef.current;
    const bars = burgerRef.current?.querySelectorAll("span");
    if (!panel || !bars) return;
    const next = !open;
    setOpen(next);
    if (next) {
      document.body.style.overflow = "hidden"; // sheet open — page holds still
      const links = panel.querySelectorAll("a:not([data-panel-jump])");
      const jump = panel.querySelector("[data-panel-jump]");
      gsap
        .timeline()
        .to(panel, { yPercent: 0, duration: 0.4, ease: "power3.out" }, 0)
        // links cascade in from the left while the sheet is still landing
        .fromTo(
          links,
          { x: -60, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out", stagger: 0.07 },
          0.12,
        )
        // the CTA pops up last with a little overshoot
        .fromTo(
          jump,
          { y: 48, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.6, ease: "back.out(4)" },
          0.3,
        );
      gsap.to(bars[0], { rotate: 45, y: "0.4375rem", duration: 0.2, ease: "power3.out" });
      gsap.to(bars[1], { autoAlpha: 0, duration: 0.15 });
      gsap.to(bars[2], { rotate: -45, y: "-0.4375rem", duration: 0.2, ease: "power3.out" });
    } else {
      document.body.style.overflow = "";
      gsap.to(panel, { yPercent: -100, duration: 0.24, ease: "power2.in" });
      gsap.to(bars, { rotate: 0, y: 0, autoAlpha: 1, duration: 0.2, ease: "power3.out" });
    }
  };

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const navLogo = nav.querySelector<HTMLElement>("[data-nav-logo]");
    const heroLogo = document.querySelector<HTMLElement>("[data-hero-logo]");
    if (!navLogo) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let flight: HTMLElement | null = null;
    let homeCleanup: (() => void) | null = null;

    const killFlight = () => {
      flight?.remove();
      flight = null;
    };

    const ctx = gsap.context(() => {
      // y: 0 clears the CSS translateY(-100%) first-paint fallback so it
      // doesn't stack with yPercent (same trap as the panel below).
      gsap.set(nav, { y: 0, yPercent: -100 });
      // y: 0 clears the CSS translateY(-100%) fallback — otherwise it stacks
      // with yPercent and parks the panel at -200%, where opening to 0%
      // yPercent still leaves it offscreen.
      if (panelRef.current) gsap.set(panelRef.current, { y: 0, yPercent: -100 });

      const showNav = () => {
        // Measure the hero logo BEFORE touching the nav, then park the nav at
        // its final position so Flip measures the logo's TRUE destination —
        // measuring mid-slide sent the clone to a stale spot and made the nav
        // logo pop in late.
        const rect = heroLogo?.getBoundingClientRect();
        const visible = rect && rect.bottom > 0 && rect.top < window.innerHeight;

        gsap.killTweensOf(nav);
        gsap.set(nav, { yPercent: 0 });

        if (!reduced && heroLogo && rect && visible) {
          killFlight();
          const clone = heroLogo.cloneNode(true) as HTMLElement;
          flight = clone;
          gsap.set(clone, {
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            margin: 0,
            zIndex: 950,
          });
          document.body.appendChild(clone);
          gsap.set([heroLogo, navLogo], { visibility: "hidden" });
          Flip.fit(clone, navLogo, {
            duration: 0.22,
            ease: "power2.out",
            absolute: true,
            onComplete: () => {
              gsap.set(navLogo, { visibility: "visible" });
              killFlight();
            },
          });
        } else {
          gsap.set(navLogo, { visibility: "visible" });
          if (heroLogo) gsap.set(heroLogo, { visibility: "hidden" });
        }

        // Slide the nav in AFTER Flip captured the destination bounds.
        gsap.from(nav, { yPercent: -100, duration: 0.22, ease: "power3.out" });
      };

      let navShown = false;
      const hideNav = () => {
        if (!navShown) return;
        navShown = false;
        killFlight();
        gsap.killTweensOf(nav); // never let show/hide tweens overlap
        gsap.to(nav, { yPercent: -100, duration: 0.15, ease: "power2.in" });
        gsap.set(navLogo, { visibility: "hidden" });
        if (heroLogo) gsap.set(heroLogo, { visibility: "visible" });
      };
      const show = () => {
        if (navShown) return;
        navShown = true;
        showNav();
      };

      ScrollTrigger.create({
        start: 10, // "as soon as" scrolling begins
        onEnter: show,
        onLeaveBack: hideNav,
      });
      // The hero announces the glide home the instant it starts — exit now,
      // not when the scroll position eventually crosses a line.
      window.addEventListener("proovd:home", hideNav);
      homeCleanup = () => window.removeEventListener("proovd:home", hideNav);

      // Landing mid-page (reload with scroll restoration): nav appears at once.
      if (window.scrollY > 10) {
        navShown = true;
        gsap.set(nav, { yPercent: 0 });
        gsap.set(navLogo, { visibility: "visible" });
        if (heroLogo) gsap.set(heroLogo, { visibility: "hidden" });
      }

      // Over the 14-days section the bar goes transparent — the calendar
      // photo runs right up to the top edge.
      const days = document.getElementById("days");
      if (days) {
        ScrollTrigger.create({
          trigger: days,
          start: () => `top top+=${nav.offsetHeight}`,
          end: "bottom top",
          toggleClass: { targets: nav, className: styles.navClear },
        });
      }
    }, nav);

    return () => {
      killFlight();
      homeCleanup?.();
      document.body.style.overflow = "";
      ctx.revert();
    };
  }, []);

  return (
    <>
      <nav ref={navRef} className={styles.nav} aria-label="Main">
        <a href="/">
          <img
            className={styles.logo}
            src="/assets/Proovd Logo.png"
            alt="Proovd"
            data-nav-logo
          />
        </a>
        <div className={styles.links}>
          <a className={styles.link} href="#idea" data-hover="underline">
            Got an idea?
          </a>
          <a className={styles.link} href="#product" data-hover="underline">
            Got a product?
          </a>
          <a className={styles.link} href="#affiliate" data-hover="underline">
            I’m an affiliate
          </a>
          <a className={styles.jump} href="#start" data-hover="sweep">
            Jump in
          </a>
        </div>
        <button
          ref={burgerRef}
          type="button"
          className={styles.burger}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={toggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* phone menu sheet — slides down from behind the navbar */}
      <div ref={panelRef} className={styles.panel}>
        <a className={styles.panelLink} href="#idea" onClick={toggleMenu}>
          Got an idea?
        </a>
        <a className={styles.panelLink} href="#product" onClick={toggleMenu}>
          Got a product?
        </a>
        <a className={styles.panelLink} href="#affiliate" onClick={toggleMenu}>
          I’m an affiliate
        </a>
        <a
          className={styles.panelJump}
          href="#start"
          onClick={toggleMenu}
          data-panel-jump
        >
          Jump in
        </a>
      </div>
    </>
  );
}
