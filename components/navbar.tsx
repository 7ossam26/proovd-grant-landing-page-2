"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { EASE, playFrom, playTo } from "@/lib/motion";
import styles from "./navbar.module.css";

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
      const links = panel.querySelectorAll<HTMLElement>(
        "a:not([data-panel-jump])",
      );
      const jump = panel.querySelector<HTMLElement>("[data-panel-jump]");
      playTo(
        panel,
        { transform: "translateY(0%)" },
        { duration: 0.4, ease: EASE.out3 },
      );
      // links cascade in from the left while the sheet is still landing —
      // visibility in the from-frame keeps them autoAlpha-hidden (not
      // focusable/hit-testable) through the backwards-fill delay window
      links.forEach((link, i) => {
        playFrom(
          link,
          { opacity: 0, visibility: "hidden", transform: "translateX(-60px)" },
          { duration: 0.45, delay: 0.12 + i * 0.07, ease: EASE.out3 },
        );
      });
      // the CTA pops up last with a little overshoot
      if (jump) {
        playFrom(
          jump,
          { opacity: 0, visibility: "hidden", transform: "translateY(48px)" },
          { duration: 0.6, delay: 0.3, ease: EASE.backOut4 },
        );
      }
      playTo(
        bars[0],
        { transform: "translateY(0.4375rem) rotate(45deg)" },
        { duration: 0.2, ease: EASE.out3 },
      );
      // gsap.to's default ease was power1.out; visibility lands hidden at the
      // end of the fade, matching autoAlpha: 0
      playTo(
        bars[1],
        { opacity: "0", visibility: "hidden" },
        { duration: 0.15, ease: EASE.out1 },
      );
      playTo(
        bars[2],
        { transform: "translateY(-0.4375rem) rotate(-45deg)" },
        { duration: 0.2, ease: EASE.out3 },
      );
    } else {
      document.body.style.overflow = "";
      playTo(
        panel,
        { transform: "translateY(-100%)" },
        { duration: 0.24, ease: EASE.in2 },
      );
      for (const bar of bars) {
        playTo(
          bar,
          {
            transform: "translateY(0px) rotate(0deg)",
            opacity: "1",
            visibility: "visible", // autoAlpha: 1 — un-hide the middle bar
          },
          { duration: 0.2, ease: EASE.out3 },
        );
      }
    }
  };

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const navLogo = nav.querySelector<HTMLElement>("[data-nav-logo]");
    const heroLogo = document.querySelector<HTMLElement>("[data-hero-logo]");
    if (!navLogo) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const panel = panelRef.current;
    // Live animations only — settled ones drop out so the array can't grow
    // for the life of the page (GSAP released completed tweens itself).
    const anims: Animation[] = [];
    const track = (a: Animation) => {
      anims.push(a);
      const drop = () => {
        const i = anims.indexOf(a);
        if (i !== -1) anims.splice(i, 1);
      };
      a.finished.then(drop).catch(drop);
    };
    let flight: HTMLElement | null = null;

    const killFlight = () => {
      flight?.remove();
      flight = null;
    };

    // The stylesheet parks both offscreen for first paint; taking an inline
    // copy of that transform makes it ours to overwrite and tween (the
    // element's own translateY(-100%) equals the old yPercent -100).
    nav.style.transform = "translateY(-100%)";
    if (panel) panel.style.transform = "translateY(-100%)";

    const showNav = () => {
      // Measure the hero logo BEFORE touching the nav, then park the nav at
      // its final position so the flight measures the logo's TRUE
      // destination — measuring mid-slide sent the clone to a stale spot and
      // made the nav logo pop in late.
      const rect = heroLogo?.getBoundingClientRect();
      const visible = rect && rect.bottom > 0 && rect.top < window.innerHeight;

      for (const a of nav.getAnimations()) a.cancel(); // no overlapping slides
      nav.style.transform = "translateY(0px)";

      if (!reduced && heroLogo && rect && visible) {
        killFlight();
        const clone = heroLogo.cloneNode(true) as HTMLElement;
        flight = clone;
        clone.style.position = "fixed";
        clone.style.top = `${rect.top}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.margin = "0";
        clone.style.zIndex = "950";
        clone.style.transformOrigin = "0 0";
        document.body.appendChild(clone);
        heroLogo.style.visibility = "hidden";
        navLogo.style.visibility = "hidden";
        // Manual FLIP: fly the clone from the hero rect onto the nav logo's
        // rect — translate then scale, from the top-left corner.
        const dest = navLogo.getBoundingClientRect();
        const dx = dest.left - rect.left;
        const dy = dest.top - rect.top;
        const sx = dest.width / rect.width;
        const sy = dest.height / rect.height;
        const fly = clone.animate(
          [
            { transform: "translate(0px, 0px) scale(1, 1)" },
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          ],
          { duration: 220, easing: EASE.out2, fill: "forwards" },
        );
        track(fly);
        const land = () => {
          navLogo.style.visibility = "visible";
          killFlight();
        };
        fly.finished.then(land).catch(land);
      } else {
        navLogo.style.visibility = "visible";
        if (heroLogo) heroLogo.style.visibility = "hidden";
      }

      // Slide the nav in AFTER the flight captured the destination bounds.
      // playFrom clears the inline park, so restore the resting transform
      // right after — the tween's implicit end keyframe reads it live, and
      // it keeps the nav at 0 once the backwards-fill lets go (the
      // stylesheet would otherwise park it back at -100%).
      track(
        playFrom(
          nav,
          { transform: "translateY(-100%)" },
          { duration: 0.22, ease: EASE.out3 },
        ),
      );
      nav.style.transform = "translateY(0px)";
    };

    let navShown = false;
    const hideNav = () => {
      if (!navShown) return;
      navShown = false;
      killFlight();
      // playTo freezes any in-flight slide — show/hide tweens never overlap.
      track(
        playTo(
          nav,
          { transform: "translateY(-100%)" },
          { duration: 0.15, ease: EASE.in2 },
        ),
      );
      navLogo.style.visibility = "hidden";
      if (heroLogo) heroLogo.style.visibility = "visible";
    };
    const show = () => {
      if (navShown) return;
      navShown = true;
      showNav();
    };

    // One rAF-throttled scroll listener replaces both scroll triggers: the
    // show/hide line 10px down (the guards make it fire only on crossings),
    // and the stretch where the bar goes transparent over the 14-days
    // section — the calendar photo runs right up to the top edge.
    const days = document.getElementById("days");
    let raf = 0;
    const onScrollFrame = () => {
      raf = 0;
      if (window.scrollY > 10) show();
      else hideNav();
      if (days) {
        const r = days.getBoundingClientRect();
        const active = r.top <= nav.offsetHeight && r.bottom >= 0;
        nav.classList.toggle(styles.navClear, active);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(onScrollFrame);
    };

    // Landing mid-page (reload with scroll restoration): nav appears at once.
    if (window.scrollY > 10) {
      navShown = true;
      nav.style.transform = "translateY(0px)";
      navLogo.style.visibility = "visible";
      if (heroLogo) heroLogo.style.visibility = "hidden";
    }
    onScrollFrame(); // settle both states for wherever the page loaded
    window.addEventListener("scroll", onScroll, { passive: true });
    // Resize moves the #days boundary without a scroll event (ScrollTrigger
    // used to refresh itself here) — re-evaluate so navClear can't go stale.
    window.addEventListener("resize", onScroll);

    return () => {
      killFlight();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      for (const a of anims) a.cancel();
      document.body.style.overflow = "";
      // Hand everything back to the stylesheet, visible and un-transformed.
      nav.style.removeProperty("transform");
      navLogo.style.removeProperty("visibility");
      heroLogo?.style.removeProperty("visibility");
      panel?.style.removeProperty("transform");
      nav.classList.remove(styles.navClear);
    };
  }, []);

  return (
    <>
      <nav ref={navRef} className={styles.nav} aria-label="Main">
        <a href="/">
          <img
            className={styles.logo}
            src="/assets/Proovd Logo.webp"
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
            Got an audience?
          </a>
          <a className={styles.jump} href="#start" data-hover="primary">
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
          Got an audience?
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
