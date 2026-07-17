"use client";

import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLayoutEffect, useRef, useState } from "react";
import { glideBusy, glideGate, glideTo, intentTick } from "./scroll-glide";
import styles from "./evan-section.module.css";

gsap.registerPlugin(Flip, ScrollTrigger, SplitText);

// titleScale / bodyScale shrink longer copy so every slide fits the same
// footprint as the first one — the text block must never grow and push the
// layout down.
const SLIDES = [
  {
    img: "/assets/Evan_Idea.webp",
    alt: "Evan surrounded by sticky notes, thinking",
    title: "has an Idea",
    titleScale: 1,
    body:
      "It lives in a half-finished Notion doc and a 2 am voice memo. One question he can’t shake: would anyone actually pay for it?",
    bodyScale: 1,
  },
  {
    img: "/assets/saying_his_idea_evan.webp",
    alt: "Evan saying his idea out loud",
    title: "speaks it out loud",
    titleScale: 0.75,
    body:
      "He tells Proovd the problem and his fix. As if he’s talking to a friend, Proovd turns it from a messy train of thought into a campaign page people can back.",
    bodyScale: 1,
  },
  {
    img: "/assets/Campaign_Evan.webp",
    alt: "Evan matched with a creator",
    title: "gets matched",
    titleScale: 0.75,
    body:
      "Proovd pairs him with a vetted YouTuber: 80K subs, exactly his niche. Getting strangers to care just became someone else’s job.",
    bodyScale: 1,
  },
  {
    img: "/assets/Live_Evan.webp",
    alt: "The campaign going live",
    title: "Campaign goes live",
    titleScale: 0.75,
    body:
      "The creator hits post and 80,000 people see it while it’s still just an idea. The ones who want it reserve theirs. Their card gets saved, not charged yet.",
    bodyScale: 1,
  },
  {
    img: "/assets/Money_Evan.webp",
    alt: "The campaign making money",
    title: "has users",
    titleScale: 0.75,
    body:
      "The campaign hits its pre-order goal. Saved cards get charged, and Evan starts building with money in the bank and his first customers waiting.",
    bodyScale: 1,
  },
];

// product mode: the same journey, told about the app he already built
const PRODUCT_SLIDES = [
  {
    img: "/assets/Product_Evan.webp",
    alt: "Evan with the app he built",
    title: "has an app built",
    titleScale: 0.8,
    body:
      "A study planner, built instead of studying for finals, live on TestFlight with 12 users, all of them friends. The app works and nobody knows it exists.",
    bodyScale: 1,
  },
  {
    img: "/assets/saying_his_idea_evan.webp",
    alt: "Evan showing what his app does",
    title: "tells us what his app does",
    titleScale: 0.75,
    body:
      "He tells Proovd about the app, as if he’s talking to a friend. We turn it from a messy explanation into a campaign page people can back.",
    bodyScale: 1,
  },
  {
    img: "/assets/Campaign_Evan.webp",
    alt: "Evan matched with a creator",
    title: "gets matched",
    titleScale: 0.75,
    body:
      "Proovd pairs him with a vetted YouTuber: 80K subs, exactly his niche. Reaching past his friend group just became someone else’s job.",
    bodyScale: 1,
  },
  {
    img: "/assets/Live_Evan.webp",
    alt: "The campaign going live",
    title: "Campaign goes live",
    titleScale: 0.75,
    body:
      "The creator hits post, and 80,000 people meet the app today. The ones who want in reserve a founding-member spot. Their card is saved, not charged yet.",
    bodyScale: 1,
  },
  {
    img: "/assets/Money_Evan.webp",
    alt: "The campaign making money",
    title: "has users",
    titleScale: 0.75,
    body:
      "When the campaign closes, the saved cards get charged and he keeps whatever came in. His app finally has users he can keep building for.",
    bodyScale: 1,
  },
];

export function EvanSection() {
  const rootRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<"idea" | "product">("idea");
  const [slide, setSlide] = useState(0);
  const slideRef = useRef(0); // mirrors `slide` for the scroll listeners
  const slideBusy = useRef(false);
  const slideDir = useRef(1); // 1 = forward, -1 = back — sets the travel direction
  const slideMounted = useRef(false);
  // a step requested mid-transition is remembered and fired the moment the
  // transition ends — clicks must never be silently swallowed
  const pendingStep = useRef(0);
  // the opening "This is Evan" statement is playing — all scrolling holds,
  // so a keep-scrolling user can't land themselves mid-carousel
  const introBusy = useRef(false);
  // the wheel effect's "glide to the next section" — shared with the cursor
  const commitDownRef = useRef<(() => void) | null>(null);
  // re-aims the sticker cursor's arrow — called the moment a step happens,
  // so the arrow never waits for the next mousemove to flip
  const refreshAimRef = useRef<(() => void) | null>(null);
  // live snapshots of the outgoing slide, overlaid while the new one enters
  const clonesRef = useRef<{ photo?: HTMLElement; text?: HTMLElement }>({});

  const killClones = () => {
    clonesRef.current.photo?.remove();
    clonesRef.current.text?.remove();
    clonesRef.current = {};
  };

  // the effect queries these markers — the snapshot must never answer for
  // the live elements
  const stripMarkers = (el: HTMLElement) => {
    for (const name of ["data-idea-photo", "data-idea-title", "data-idea-body", "data-swap"]) {
      el.removeAttribute(name);
      el.querySelectorAll(`[${name}]`).forEach((c) => c.removeAttribute(name));
    }
  };

  // Snapshot the outgoing photo and text IN PLACE, right before the swap.
  // The new content renders underneath the snapshots, so old and new truly
  // overlap — no dead gap, nothing teleports.
  const snapshotOutgoing = (root: HTMLElement) => {
    killClones();
    const frame = root.querySelector<HTMLElement>("[data-photo-frame]");
    const photo = root.querySelector<HTMLElement>("[data-idea-photo]");
    const swap = root.querySelector<HTMLElement>("[data-swap]");
    if (frame && photo) {
      const clone = photo.cloneNode(true) as HTMLElement;
      stripMarkers(clone);
      clone.setAttribute("aria-hidden", "true");
      gsap.set(clone, { position: "absolute", inset: 0, margin: 0, pointerEvents: "none" });
      frame.insertBefore(clone, photo); // before → the live img paints on top
      clonesRef.current.photo = clone;
    }
    if (swap) {
      const clone = swap.cloneNode(true) as HTMLElement;
      stripMarkers(clone);
      clone.setAttribute("aria-hidden", "true");
      gsap.set(clone, { position: "absolute", top: 0, left: 0, width: "100%", pointerEvents: "none" });
      swap.appendChild(clone);
      clonesRef.current.text = clone;
    }
  };

  const goTo = (next: number) => {
    if (next === slideRef.current || slideBusy.current) return;
    slideDir.current = next > slideRef.current ? 1 : -1;
    slideRef.current = next;
    refreshAimRef.current?.();
    const root = rootRef.current;
    if (
      !root ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setSlide(next);
      return;
    }
    slideBusy.current = true;
    snapshotOutgoing(root);
    setSlide(next);
  };

  // Mode toggle = the SAME card slap the slides use — one motion language
  // for the whole section. Direction comes from the tabs themselves:
  // switching to "product" (the right tab) travels right, back travels left.
  const switchMode = (m: "idea" | "product") => {
    if (m === mode || slideBusy.current) return;
    slideDir.current = m === "product" ? 1 : -1;
    slideRef.current = 0; // a mode change always reopens on chapter one
    refreshAimRef.current?.();
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode(m);
      setSlide(0);
      return;
    }
    slideBusy.current = true;
    snapshotOutgoing(root);
    setMode(m);
    setSlide(0);
  };

  // In: runs after React swapped the slide content — the outgoing snapshots
  // (made in goTo) still sit in place. One axis, one focal chain: the new
  // photo slaps down on top of the old like a card on a stack, then the
  // title+body follow as ONE solid block along the same travel direction.
  useLayoutEffect(() => {
    if (!slideMounted.current) {
      slideMounted.current = true;
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const title = root.querySelector<HTMLElement>("[data-idea-title]");
    const body = root.querySelector<HTMLElement>("[data-idea-body]");
    const photo = root.querySelector<HTMLElement>("[data-idea-photo]");
    const { photo: oldPhoto, text: oldText } = clonesRef.current;
    // release the hold, then fire any step that queued up mid-transition
    const finishStep = () => {
      slideBusy.current = false;
      const queued = pendingStep.current;
      pendingStep.current = 0;
      if (queued) {
        const target = slideRef.current + queued;
        if (target >= 0 && target < SLIDES.length) goTo(target);
      }
    };
    if (!title || !body || !photo) {
      killClones();
      slideBusy.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      killClones();
      finishStep();
      return;
    }
    const dir = slideDir.current;
    try {
      const tl = gsap.timeline({
        onComplete: () => {
          killClones();
          finishStep();
        },
      });
      // 1 — the card slap: new photo slides in over the old and settles flat
      tl.fromTo(
        photo,
        { xPercent: 16 * dir, rotation: 4 * dir, scale: 1.04, autoAlpha: 0 },
        { xPercent: 0, rotation: 0, scale: 1, duration: 0.55, ease: "power4.out" },
        0,
      ).to(photo, { autoAlpha: 1, duration: 0.15, ease: "none" }, 0);
      // …while the covered card recedes a touch underneath
      if (oldPhoto) {
        tl.to(
          oldPhoto,
          { scale: 0.955, autoAlpha: 0.65, duration: 0.5, ease: "power2.inOut" },
          0,
        );
      }
      // 2 — the old text gets out of the way fast…
      if (oldText) {
        tl.to(oldText, { autoAlpha: 0, duration: 0.18, ease: "power1.in" }, 0);
      }
      // …the title rips up through its mask — the hero headline's recipe —
      // and the body follows with a quiet fade
      const split = SplitText.create(title, { type: "words", mask: "words" });
      // the title's tight line-height (1.05) clips descenders inside the
      // word masks until the revert — open each mask window downward,
      // canceled by negative margin so the layout doesn't move
      const masks = split.words
        .map((w) => w.parentElement)
        .filter((p): p is HTMLElement => !!p && p !== title);
      gsap.set(masks, { paddingBottom: "0.18em", marginBottom: "-0.18em" });
      tl.from(
        split.words,
        {
          yPercent: 130, // fully below the (now taller) mask window
          duration: 0.45,
          ease: "power4.out",
          stagger: 0.04,
          onComplete: () => split.revert(),
        },
        0.12,
      ).fromTo(
        body,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
        0.24,
      );
    } catch {
      // Motion must never leave content hidden (§6.6).
      gsap.set([title, body, photo], { clearProps: "all" });
      killClones();
      finishStep();
    }
  }, [slide, mode]);

  // stray snapshots must not outlive the section
  useLayoutEffect(() => {
    return () => {
      clonesRef.current.photo?.remove();
      clonesRef.current.text?.remove();
      clonesRef.current = {};
    };
  }, []);

  // Same logic as the hero handoff: a real wheel tick commits a step
  // IMMEDIATELY, input is held while the transition plays, released after.
  // Two small guards replace the hero's "already at the target" geometry
  // (which a carousel doesn't have):
  //   · settle window — while the stream keeps flowing after a step (a
  //     fling's decaying momentum tail), only a HARD tick steps again; a
  //     150ms pause in the stream ends the window
  //   · dribble filter — tiny deltas are tail noise, never intent
  // Deliberate input always lands instantly: a mouse notch (~100) and a real
  // trackpad flick both clear the hard-tick bar even mid-settle.
  // Capture phase so the hero's own wheel hijack never sees handled events.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const last = SLIDES.length - 1;

    const engaged = () => {
      const r = root.getBoundingClientRect();
      return r.top <= 2 && r.bottom >= window.innerHeight - 2;
    };

    const SETTLE_MS = 150; // stream quiet this long = the tail is dead
    const TICK = 40; // below this a delta is dribble, not intent
    const HARD_TICK = 80; // cuts through the settle window

    let acc = 0;
    let lastDir = 0;
    let lastActiveAt = 0;
    let lastEventAt = 0;

    // past the last chapter, scrolling down COMMITS a glide to the next
    // section — the same scroll help the hero gives — instead of mushy
    // free scroll. The glide lives in the shared scroll-glide module, so
    // its landing tail can't trip the creators helper.
    const commitDown = () => {
      if (glideBusy()) return;
      const pin = root.parentElement ?? root;
      glideTo(pin.offsetTop + pin.offsetHeight, 1);
    };
    commitDownRef.current = commitDown;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      // the opening statement is playing — every tick holds until it hands
      // off to the carousel
      if (introBusy.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // a glide in flight, or the dying tail of one that just landed here
      // (hero → Evan, creators → Evan) — swallowed before it can step a
      // chapter or fall through to the hero's glide home
      if (glideGate(e)) {
        e.stopPropagation();
        return;
      }
      if (!engaged()) {
        // near-alignment drift: tiny trackpad deltas (below every intent
        // threshold) used to slide the page right past this un-pinned
        // section — the engagement window is only ~4px tall. Inside the
        // band, a real gesture re-parks the section on its rail instead.
        const r = root.getBoundingClientRect();
        if (r.top < -2 && r.top > -window.innerHeight * 0.35) {
          e.preventDefault();
          e.stopPropagation();
          if (intentTick(e)) {
            glideTo(
              (root.parentElement ?? root).offsetTop,
              e.deltaY > 0 ? 1 : -1,
            );
          }
        }
        return;
      }

      const now = performance.now();
      const dir = e.deltaY > 0 ? 1 : -1;
      const mag = Math.abs(e.deltaY);
      const cur = slideRef.current;

      // a direction flip is unambiguous intent — momentum tails never
      // reverse — so it ends the settle window on the spot
      if (lastDir !== 0 && dir !== lastDir) {
        lastActiveAt = 0;
        acc = 0;
      }
      lastDir = dir;

      if (slideBusy.current) {
        // transition playing — hold input, exactly like the hero glide
        lastActiveAt = now;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const settling = now - lastActiveAt < SETTLE_MS;
      if (settling) lastActiveAt = now; // a continuous stream stays settling

      // gentle (sub-tick) input accumulates so slow scrolling still works;
      // a pause or direction flip starts the count fresh
      if (now - lastEventAt > SETTLE_MS || (acc !== 0 && Math.sign(acc) !== dir)) {
        acc = 0;
      }
      lastEventAt = now;

      let fires: boolean;
      if (settling) {
        fires = mag >= HARD_TICK;
      } else {
        acc += e.deltaY;
        fires = mag >= TICK || Math.abs(acc) >= TICK;
      }

      // a step-worthy tick at either end leaves the carousel — up falls
      // through to the hero's glide home, down COMMITS the glide to the
      // next section (the hero's scroll help); dribble never does either
      if (fires && dir < 0 && cur === 0) {
        return;
      }
      if (fires && dir > 0 && cur === last) {
        e.preventDefault();
        e.stopPropagation();
        commitDown();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!fires) return;
      acc = 0;
      lastActiveAt = now;
      goTo(cur + dir);
    };

    // Phone: scrolling is 100% native — the section pins via CSS sticky and
    // each chapter owns a stretch of real scroll room with a native snap
    // stop. This PASSIVE listener only watches where the scroll landed and
    // steps the carousel to match; it never blocks or fights the scroll.
    const pin = root.parentElement; // .pinSpace

    // ONE chapter per swipe, however hard the fling. The CSS snap marks ask
    // for scroll-snap-stop: always, but mobile browsers still sail past
    // them on strong flings — so each gesture (the touch plus its momentum
    // tail) is clamped to a single step from the chapter it began on.
    // Overshoot kills the momentum (overflow: hidden for one frame) and
    // parks the page exactly on the neighboring chapter's snap mark.
    let gestureBase = 0; // chapter when this gesture began
    let gestureLive = false; // finger down, or momentum still streaming
    let gestureQuiet = 0;
    const onScroll = () => {
      if (!pin) return;
      const stepPx = (pin.offsetHeight - root.offsetHeight) / last;
      if (stepPx <= 0) return; // desktop layout — wrapper adds no room
      const y = window.scrollY;
      const zoneEnd = pin.offsetTop + last * stepPx;

      // statement playing: any scroll into the chapter zone is cut dead and
      // parked on chapter 0 until the intro hands off
      if (introBusy.current) {
        if (y > pin.offsetTop && y < zoneEnd) {
          const el = document.documentElement;
          el.style.overflow = "hidden"; // kills the momentum
          window.scrollTo({ top: pin.offsetTop });
          requestAnimationFrame(() => {
            el.style.overflow = "";
          });
        }
        gestureLive = false; // whatever fling this was ends here
        return;
      }

      if (!gestureLive) {
        gestureLive = true;
        gestureBase = slideRef.current;
      }
      clearTimeout(gestureQuiet);
      gestureQuiet = window.setTimeout(() => {
        gestureLive = false; // stream went quiet — the gesture is over
      }, 160);

      const idx = Math.max(
        0,
        Math.min(last, Math.round((y - pin.offsetTop) / stepPx)),
      );
      const clamped = Math.max(gestureBase - 1, Math.min(gestureBase + 1, idx));

      // ran past the one-step budget while still inside the chapter zone:
      // cut the fling dead and park on the neighbor
      if (idx !== clamped && y > pin.offsetTop && y < zoneEnd) {
        const el = document.documentElement;
        el.style.overflow = "hidden"; // kills the momentum
        window.scrollTo({ top: pin.offsetTop + clamped * stepPx });
        requestAnimationFrame(() => {
          el.style.overflow = "";
        });
      }

      const cur = slideRef.current;
      if (clamped === cur) return;
      const dir = clamped > cur ? 1 : -1;
      if (slideBusy.current) {
        pendingStep.current = dir; // catch up when the transition settles
        return;
      }
      goTo(cur + dir);
    };

    // Touch: a horizontal SWIPE pages the carousel (vertical scroll stays
    // native). After a swipe, the pinned scroll offset is silently synced to
    // the new chapter — the section is stuck in place, so nothing visibly
    // jumps, and the scroll-position model stays consistent.
    let tx = 0;
    let ty = 0;
    let swiped = false;
    const onTouchStart = (e: TouchEvent) => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
      swiped = false;
      gestureLive = false; // fresh finger = fresh one-chapter budget
    };
    const onTouchMove = (e: TouchEvent) => {
      if (swiped || slideBusy.current) return;
      const dx = e.touches[0].clientX - tx;
      const dy = e.touches[0].clientY - ty;
      // clearly sideways, clearly deliberate
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      swiped = true; // one step per gesture
      const cur = slideRef.current;
      const target = cur + (dx < 0 ? 1 : -1); // swipe left → next
      if (target < 0 || target > last) return;
      goTo(target);
      if (pin) {
        const stepPx = (pin.offsetHeight - root.offsetHeight) / last;
        if (stepPx > 0) window.scrollTo({ top: pin.offsetTop + target * stepPx });
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    const touch = window.matchMedia("(hover: none)").matches;
    if (touch) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(gestureQuiet);
      window.removeEventListener("wheel", onWheel, true);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      if (touch) window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Sticker cursor: on mouse devices the pointer becomes a brand-green arrow
  // badge over the slides — pointing back on the left half of the page,
  // forward on the right — and clicking steps that way.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const cursor = root.querySelector<HTMLElement>("[data-cursor]");
    const badge = root.querySelector<HTMLElement>("[data-cursor-badge]");
    const arrow = root.querySelector<HTMLElement>("[data-cursor-arrow]");
    const statementWrap = root.querySelector<HTMLElement>("[data-statement-wrap]");
    if (!cursor || !badge || !arrow) return;

    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.08, ease: "power3.out" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.08, ease: "power3.out" });

    let shown = false;
    // where a press would take you: back a chapter, forward a chapter, or —
    // on the last chapter — down to the next section
    let aim: "back" | "next" | "down" = "next";
    const ROT = { back: 180, next: 0, down: 90 } as const;

    // only once the statement handed off to the slide layout
    const ready = () =>
      !statementWrap || getComputedStyle(statementWrap).display === "none";

    // over real controls the normal pointer takes back over
    const overUi = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("button, a");

    const show = () => {
      if (shown) return;
      shown = true;
      root.classList.add(styles.cursorOn);
      root.style.cursor = "none"; // inline so nothing in the cascade can win
      gsap.to(cursor, { autoAlpha: 1, duration: 0.12 });
      gsap.fromTo(badge, { scale: 0.6 }, { scale: 1, duration: 0.2, ease: "back.out(2)" });
    };
    const hide = () => {
      if (!shown) return;
      shown = false;
      root.classList.remove(styles.cursorOn);
      root.style.cursor = "";
      gsap.to(cursor, { autoAlpha: 0, duration: 0.15 });
    };

    let lastX = -1;
    const applyAim = () => {
      if (lastX < 0) return; // no pointer seen yet
      const cur = slideRef.current;
      const nextAim =
        lastX < window.innerWidth / 2
          ? "back"
          : cur >= SLIDES.length - 1
            ? "down" // last chapter: forward means onward to the next section
            : "next";
      if (nextAim !== aim) {
        aim = nextAim;
        gsap.to(arrow, { rotation: ROT[aim], duration: 0.12, ease: "power2.out" });
      }
      // nowhere to go that way — the sticker dims to say so (back on
      // chapter one is the only dead end left)
      const can = aim !== "back" || cur > 0;
      gsap.to(badge, { opacity: can ? 1 : 0.4, duration: 0.15 });
    };
    refreshAimRef.current = applyAim;

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      lastX = e.clientX;
      if (!ready() || overUi(e.target)) {
        hide();
        return;
      }
      show();
      applyAim();
    };

    const onLeave = () => hide();

    // pointerdown, NOT click: a click needs mousedown + mouseup on the same
    // element, and mid-transition the DOM under the pointer is being swapped
    // (React re-render, SplitText spans) — presses were vanishing. The press
    // itself is the intent.
    const onPress = (e: PointerEvent) => {
      if (e.button !== 0) return; // left button only
      // a REAL mouse only — on touchscreens pointerdown fires for taps too,
      // and tapping must never page the carousel
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (!ready() || overUi(e.target)) return;
      gsap.fromTo(badge, { scale: 0.85 }, { scale: 1, duration: 0.3, ease: "back.out(3)" });
      if (aim === "down") {
        commitDownRef.current?.(); // glide on to the next section
        return;
      }
      const step = aim === "back" ? -1 : 1;
      if (slideBusy.current) {
        // mid-transition — queue it, it fires the moment the slide settles
        pendingStep.current = step;
        return;
      }
      const target = slideRef.current + step;
      if (target >= 0 && target < SLIDES.length) goTo(target);
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("pointerdown", onPress);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("pointerdown", onPress);
      root.classList.remove(styles.cursorOn);
      root.style.cursor = "";
      refreshAimRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const statementWrap = root.querySelector<HTMLElement>("[data-statement-wrap]");
    const words = root.querySelectorAll<HTMLElement>("[data-words]");
    const mask = root.querySelector<HTMLElement>("[data-photo-mask]");
    const photo = root.querySelector<HTMLElement>("[data-photo]");
    const detail = root.querySelector<HTMLElement>("[data-detail]");
    const thumb = root.querySelector<HTMLElement>("[data-thumb]");
    const toggle = root.querySelector<HTMLElement>("[data-toggle]");
    const ideaPhoto = root.querySelector<HTMLElement>("[data-idea-photo]");
    const title = root.querySelector<HTMLElement>("[data-idea-title]");
    const evanName = root.querySelector<HTMLElement>("[data-evan-name]");
    const body = root.querySelector<HTMLElement>("[data-idea-body]");
    const dots = root.querySelectorAll<HTMLElement>("[data-dot]");

    if (
      !statementWrap || !words.length || !mask || !photo || !detail ||
      !thumb || !title
    ) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No motion: skip the statement entirely, land on the final layout.
      gsap.set(statementWrap, { display: "none" });
      return;
    }

    let cancelled = false;
    let flight: HTMLElement | null = null;
    const killFlight = () => {
      flight?.remove();
      flight = null;
    };

    // while the statement plays, active touch scrolling is blocked outright
    // (the wheel and scroll listeners check introBusy for everything else)
    const holdTouch = (e: Event) => e.preventDefault();
    const releaseIntro = () => {
      introBusy.current = false;
      window.removeEventListener("touchmove", holdTouch);
    };

    const ctx = gsap.context(() => {
      gsap.set(words, { autoAlpha: 0 });
      const maskWidth = mask.offsetWidth; // the CSS clamp width, in px, today
      gsap.set(mask, { width: 0 });
      gsap.set(detail, { autoAlpha: 0 });
      gsap.set(thumb, { visibility: "hidden" });

      // Preload the smiling frame so the end-of-animation cut is instant.
      const smiling = new Image();
      smiling.src = "/assets/Evan_main_smiling.webp";
      // …and every slide photo (both modes' openers included), so steps and
      // flips never wait on the network.
      for (const s of SLIDES) {
        new Image().src = s.img;
      }
      new Image().src = PRODUCT_SLIDES[0].img;

      const flyPhotoToThumb = () => {
        const rect = mask.getBoundingClientRect();
        killFlight();
        const clone = mask.cloneNode(true) as HTMLElement;
        flight = clone;
        gsap.set(clone, {
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          margin: 0,
          zIndex: 60,
        });
        document.body.appendChild(clone);
        gsap.set(mask, { visibility: "hidden" });
        Flip.fit(clone, thumb, {
          duration: 0.6,
          ease: "power2.inOut",
          absolute: true,
          onComplete: () => {
            gsap.set(thumb, { visibility: "visible" });
            killFlight();
          },
        });
      };

      const reveal = () => {
        if (cancelled) return;
        try {
          const split = SplitText.create(words, { type: "words", mask: "words" });
          gsap.set(words, { autoAlpha: 1 });
          const tl = gsap.timeline({
            scrollTrigger: { trigger: root, start: "top 70%", once: true },
            onStart: () => {
              introBusy.current = true;
              window.addEventListener("touchmove", holdTouch, {
                passive: false,
              });
            },
            onComplete: releaseIntro,
          });
          tl
            // Act 1 — the statement
            .from(split.words, {
              yPercent: 120,
              duration: 0.45,
              ease: "power4.out",
              stagger: 0.05,
              onComplete: () => split.revert(),
            })
            .to(
              mask,
              { width: maskWidth, duration: 0.5, ease: "power3.out" },
              "-=0.25",
            )
            .from(photo, { scale: 1.3, duration: 0.5, ease: "power3.out" }, "<")
            .call(() => photo.setAttribute("src", smiling.src), undefined, "+=0.35")
            // Act 2 — the statement becomes the idea layout
            .to(
              words,
              { autoAlpha: 0, y: -24, duration: 0.3, ease: "power2.in" },
              "+=0.5",
            )
            .call(flyPhotoToThumb, undefined, "<")
            .set(detail, { autoAlpha: 1 }, "<+0.1")
            .set(statementWrap, { display: "none" }, "<")
            // one direction, reading order — the photo flight leads the eye,
            // and the layout rises beneath it in a single top-down cascade
            .from(
              [toggle, ideaPhoto, evanName, title, body],
              { y: 28, autoAlpha: 0, duration: 0.5, ease: "power3.out", stagger: 0.08 },
              "<",
            )
            .from(
              dots,
              { yPercent: 100, autoAlpha: 0, duration: 0.45, ease: "power3.out" },
              "-=0.2",
            );
        } catch {
          // Motion must never leave content hidden (§6.6) — or scrolling
          // held behind an intro that died.
          releaseIntro();
          gsap.set(statementWrap, { display: "none" });
          gsap.set(detail, { autoAlpha: 1 });
          gsap.set(thumb, { visibility: "visible" });
        }
      };

      // Split after fonts settle, with a timeout backstop (§6.4).
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]).then(reveal);
    }, root);

    return () => {
      cancelled = true;
      releaseIntro();
      killFlight();
      ctx.revert();
    };
  }, []);

  const slides = mode === "product" ? PRODUCT_SLIDES : SLIDES;

  return (
    <div className={styles.pinSpace}>
      {/* phone-only native snap stops — one per chapter (see CSS) */}
      <div aria-hidden="true">
        {slides.map((s, i) => (
          <div
            key={s.title}
            className={styles.snapMark}
            style={{ top: `calc(${i} * var(--chapter-step))` }}
          />
        ))}
      </div>
      <section ref={rootRef} className={styles.section} id="idea">
      {/* final layout — revealed when the statement hands off */}
      <div className={styles.detail} data-detail>
        <div className={styles.toggle} data-toggle role="tablist" aria-label="Where are you at?">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "idea"}
            className={`${styles.tab} ${mode === "idea" ? styles.tabActive : ""}`}
            onClick={() => switchMode("idea")}
          >
            I have an Idea
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "product"}
            className={`${styles.tab} ${mode === "product" ? styles.tabActive : ""}`}
            onClick={() => switchMode("product")}
          >
            I have a product
          </button>
        </div>

        <div className={styles.grid}>
          <div className={styles.photoFrame} data-photo-frame>
            <img
              className={styles.ideaPhoto}
              src={slides[slide].img}
              alt={slides[slide].alt}
              data-idea-photo
            />
          </div>
          <div className={styles.col}>
            <div className={styles.evanRow}>
              <img
                className={styles.thumb}
                src="/assets/Evan_main_smiling.webp"
                alt="Evan"
                data-thumb
              />
              <span className={styles.evanName} data-evan-name>
                {/* only the live chapter reads "Evan's… Campaign goes live" */}
                {slide === 3 ? "Evan's…" : "Evan…"}
              </span>
            </div>
            <div className={styles.swap} data-swap>
              <h3
                className={styles.ideaTitle}
                style={{ "--title-scale": slides[slide].titleScale } as React.CSSProperties}
                data-idea-title
              >
                {slides[slide].title}
              </h3>
              <p
                className={styles.ideaBody}
                style={{ "--body-scale": slides[slide].bodyScale } as React.CSSProperties}
                data-idea-body
              >
                {slides[slide].body}
              </p>
            </div>
          </div>
        </div>

        {/* chapter progress — a full-width bar hugging the section bottom */}
        <div className={styles.progress} data-dot aria-hidden="true">
          <span
            className={styles.progressFill}
            style={{ width: `${((slide + 1) / slides.length) * 100}%` }}
          />
        </div>
      </div>

      {/* sticker cursor — replaces the mouse over the slides; left half of
          the page points back, right half points forward, click steps */}
      <div className={styles.cursor} data-cursor aria-hidden="true">
        <span className={styles.cursorBadge} data-cursor-badge>
          <svg
            className={styles.cursorArrow}
            data-cursor-arrow
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 12h14M12 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {/* opening statement — overlays the section, then hands off */}
      <div className={styles.statementWrap} data-statement-wrap>
        <h2 className={styles.statement}>
          <span data-words>This</span>
          <span className={styles.photoMask} data-photo-mask>
            <img
              className={styles.photo}
              src="/assets/Evan_main.webp"
              alt="Evan"
              data-photo
            />
          </span>
          <span data-words>is Evan…</span>
        </h2>
      </div>
      </section>
    </div>
  );
}
