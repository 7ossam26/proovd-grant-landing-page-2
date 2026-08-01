"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getIntroChoice, whenIntroDone } from "@/lib/intro";
import {
  activeSceneIndex,
  clamp01,
  curtainPanelProgress,
  rampBetween,
  sceneVisualAt,
  storyPositionAt,
  trackProgress,
} from "@/lib/scroll-story";
import { siteConfig } from "@/lib/site-config";
import styles from "./evan-section.module.css";

/* ─────────────────────────────────────────────────────────────────────────
   Evan — the scroll story, driven by NATIVE SCROLL AND NOTHING ELSE.

       native browser scroll → track progress → story position → visual state

   A tall `.track` supplies the scroll distance; a `.stage` sticks to the top
   of the viewport for exactly that distance; the scenes live stacked inside
   the stage and each one derives its own opacity, travel, scale, visibility
   and pointer-events from how far it sits from the current story position.

   WHAT THIS SECTION MAY NOT DO, ever again:
     · call scrollTo / scrollBy, or otherwise write the page position
     · preventDefault a wheel or touch event
     · set body { position: fixed } or lock body overflow
     · keep a virtual scroll position, a smoothed chase target, or a latched
       "current step"
     · advance the story from a timer, a transition callback, or an animation
       finishing

   Each of those was a second opinion about where the visitor was, and the
   bug reports ("frozen", "stuck after fast scrolling", "reverse doesn't
   restore", "scrollbar shows the wrong scene", "body stayed pinned") were all
   the same failure: two opinions disagreeing. There is now exactly one, and
   the browser owns it. Reversing, scrollbar jumps, resizes and tab switches
   are not handled cases — they are simply new values of `scrollY`, and the
   arithmetic in lib/scroll-story.ts is total over all of them.

   PROGRESSIVE ENHANCEMENT is the other half. The markup below is a normal
   document: six sections in flow, every image and every word readable with no
   JavaScript at all. The controller sets `data-enhanced="true"` only once it
   has successfully bound, and only that attribute turns on the sticky
   presentation. Reduced motion never enhances. A throw un-enhances.
   ───────────────────────────────────────────────────────────────────────── */

type Mode = "idea" | "product";

type Beat = {
  alt: string;
  title: string;
  body: string;
  desktop: string;
  mobile: string;
};

/** One progress tick per beat. Named rather than index-keyed so React's
 *  reconciliation has a stable identity to hold on to. */
const TICK_KEYS = ["beat-1", "beat-2", "beat-3", "beat-4"] as const;

// ── the copy, unchanged. One set per intro choice; the words are the same on
// every viewport (only the image files differ by posture, and <picture> picks
// those — no JS is involved in choosing an image any more).
type StepCopy = { alt: string; title: string; body: string };

const IDEA_COPY: StepCopy[] = [
  {
    alt: "Evan surrounded by sticky notes, thinking",
    title: "Evan has a business idea",
    body: "He thinks it’s good. No clue if anyone would pay.",
  },
  {
    alt: "Evan saying his idea out loud into his phone",
    title: "He tells Proovd",
    body: "Proovd turns it into a page people can preorder from.",
  },
  {
    alt: "Evan shaking hands with a matched creator",
    title: "Proovd finds buyers",
    body: "A partner YouTuber with 80K subscribers shares it. Evan builds and pays nothing upfront.",
  },
  {
    alt: "Evan relaxing with the money the campaign raised",
    title: "Evan starts building",
    body: "Enough people say yes. He builds for customers who already bought.",
  },
];

const PRODUCT_COPY: StepCopy[] = [
  {
    alt: "Evan with the app he built",
    title: "Evan has an app",
    body: "It works. No clue if anyone would pay.",
  },
  {
    alt: "Evan explaining what his app does",
    title: "He tells Proovd",
    body: "Proovd turns it into a page people can preorder from.",
  },
  {
    alt: "Evan shaking hands with a matched creator",
    title: "Proovd finds buyers",
    body: "A partner YouTuber with 80K subscribers shares it. Evan pays nothing upfront.",
  },
  {
    alt: "Evan relaxing with the money the campaign raised",
    title: "Evan starts selling",
    body: "Enough people say yes. He ships to customers who already bought.",
  },
];

const DESKTOP_PHOTOS = [
  "/assets/Evan_idea_desktop.webp",
  "/assets/even_saying_idea_desktop.webp",
  "/assets/campaign_evan_desktop.webp",
  "/assets/Money_Evan_desktop.webp",
];
const MOBILE_PHOTOS = [
  "/assets/Evan_idea_mobile.webp",
  "/assets/even_saying_idea_mobile.webp",
  "/assets/campaign_evan_mobile.webp",
  "/assets/money_evan_mobile.webp",
];
// PRODUCT swaps only the first subject — Evan holding the thing he built
// instead of having the idea. The other three are shared.
const PRODUCT_DESKTOP = [
  "/assets/Product_evan_desktop.webp",
  ...DESKTOP_PHOTOS.slice(1),
];
const PRODUCT_MOBILE = [
  "/assets/Product_evan_mobile.webp",
  ...MOBILE_PHOTOS.slice(1),
];

const beatsFor = (mode: Mode): Beat[] => {
  const copy = mode === "product" ? PRODUCT_COPY : IDEA_COPY;
  const desktop = mode === "product" ? PRODUCT_DESKTOP : DESKTOP_PHOTOS;
  const mobile = mode === "product" ? PRODUCT_MOBILE : MOBILE_PHOTOS;
  return copy.map((c, i) => ({ ...c, desktop: desktop[i], mobile: mobile[i] }));
};

/** Scene 0 is the opening statement, 1..n are the beats, the last is the
 *  finale. DOM order IS the index — the controller reads `[data-scene]` in
 *  order — and deriving the count from the copy keeps the two in step. */
const SCENE_COUNT = IDEA_COPY.length + 2;
const FINALE = SCENE_COUNT - 1;

// ── sub-ranges inside scene 0. Both are plain ramps over the statement's own
// distance, so scrolling back up runs them backwards with no extra code.
/** He smiles early, while the words are still up. */
const SMILE_FROM = 0.06;
const SMILE_TO = 0.34;
/** …then the white curtain lifts, unveiling the story underneath. */
const CURTAIN_FROM = 0.26;
const CURTAIN_TO = 0.86;

export function EvanSection() {
  const [mode, setMode] = useState<Mode>("idea");
  // Read synchronously on the first render, not in an effect: a layout effect
  // runs before paint but a passive effect runs after it, so deferring this
  // would show a reduced-motion visitor one painted frame of the sticky
  // presentation. It renders nothing, so there is no hydration mismatch.
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const beats = beatsFor(mode);

  // Which script to tell. The intro gate asked the question; this reads the
  // answer once it resolves. Not a scroll value — a plain render input — so
  // React state is the right home for it.
  useEffect(() => {
    let alive = true;
    whenIntroDone().then(() => {
      const choice = getIntroChoice();
      if (alive && choice) setMode(choice);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Toggling the preference mid-session re-runs the controller, which either
  // tears the enhancement down or builds it back up.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ── THE CONTROLLER. One effect, one update cycle: read geometry, compute
  //    progress, compute the active scene, write styles. Nothing else in this
  //    file touches the DOM.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!root || !track || !stage) return;

    // Reduced motion keeps the plain document: scenes in flow, every word and
    // image on screen at once, no sticky stage, no transforms to sit through.
    // Deliberately NOT "the same thing but faster".
    if (reduced) return;

    const scenes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-scene]"),
    );
    if (scenes.length !== SCENE_COUNT) return;

    const copies = scenes.map((s) =>
      s.querySelector<HTMLElement>("[data-scene-copy]"),
    );
    const medias = scenes.map((s) =>
      s.querySelector<HTMLElement>("[data-scene-media]"),
    );
    const panels = Array.from(
      root.querySelectorAll<HTMLElement>("[data-curtain-panel]"),
    );
    const ticks = Array.from(root.querySelectorAll<HTMLElement>("[data-tick]"));
    const bar = root.querySelector<HTMLElement>("[data-progress]");
    const neutral = root.querySelector<HTMLElement>("[data-photo-neutral]");
    const smiling = root.querySelector<HTMLElement>("[data-photo-smiling]");
    const pledges = Array.from(
      root.querySelectorAll<HTMLElement>("[data-pledge-card]"),
    );

    let frame = 0;
    let trackHeight = 0;
    let stageHeight = 0;
    let lastActive = -1;

    /** Geometry changes rarely; scroll changes constantly. Measuring here and
     *  reading only `rect.top` per frame keeps the paint to a single layout
     *  read, and means a URL-bar resize can't be mistaken for a scroll. */
    const measure = () => {
      trackHeight = track.offsetHeight;
      stageHeight = stage.offsetHeight;
    };

    const paint = () => {
      // ── 1. READ (one rect; everything else is cached)
      const rectTop = track.getBoundingClientRect().top;

      // ── 2. COMPUTE
      const progress = trackProgress(rectTop, trackHeight, stageHeight);
      const position = storyPositionAt(progress, SCENE_COUNT);
      const active = activeSceneIndex(position, SCENE_COUNT);

      // ── 3. WRITE — scenes
      for (let i = 0; i < scenes.length; i++) {
        const el = scenes[i];
        const v = sceneVisualAt(position - i);
        el.style.visibility = v.visible ? "visible" : "hidden";
        el.style.pointerEvents = v.interactive ? "auto" : "none";
        el.setAttribute("aria-hidden", v.visible ? "false" : "true");

        const copy = copies[i];
        if (copy) {
          copy.style.opacity = v.copyOpacity.toFixed(3);
          copy.style.transform = `translate3d(0, ${v.translateY.toFixed(1)}px, 0)`;
        }
        const media = medias[i];
        if (media) {
          media.style.opacity = v.mediaOpacity.toFixed(3);
          media.style.transform =
            `translate3d(0, ${(v.translateY * 0.35).toFixed(1)}px, 0)` +
            ` scale(${v.scale.toFixed(4)})`;
        }
      }

      // The active marker moves at the crossfade's own midpoint, so the
      // attribute and the dominant scene are the same scene by construction.
      if (active !== lastActive) {
        for (let i = 0; i < scenes.length; i++) {
          if (i === active) scenes[i].setAttribute("data-active", "");
          else scenes[i].removeAttribute("data-active");
        }
        root.dataset.activeScene = String(active);
        lastActive = active;
      }

      // ── 4. WRITE — the statement's own sub-beats (scene 0's distance)
      const intro = position; // = position - 0
      const smile = rampBetween(intro, SMILE_FROM, SMILE_TO);
      if (neutral) neutral.style.opacity = (1 - smile).toFixed(3);
      if (smiling) smiling.style.opacity = smile.toFixed(3);

      const curtain = rampBetween(intro, CURTAIN_FROM, CURTAIN_TO);
      for (let i = 0; i < panels.length; i++) {
        const p = curtainPanelProgress(curtain, i);
        panels[i].style.transform =
          `translate3d(0, ${(p * -100).toFixed(2)}%, 0)`;
      }

      // ── 5. WRITE — progress indicators
      for (let i = 0; i < ticks.length; i++) {
        ticks[i].style.setProperty("--tf", clamp01(position - i).toFixed(3));
      }
      if (bar) {
        // Up as the first beat lands, down as the finale takes over.
        const shown =
          rampBetween(position, 0.55, 1) *
          (1 - rampBetween(position, FINALE - 0.9, FINALE - 0.3));
        bar.style.opacity = shown.toFixed(3);
      }

      // ── 6. WRITE — the finale's staggered pledge cards
      const finaleAway = Math.abs(position - FINALE);
      for (let i = 0; i < pledges.length; i++) {
        const p = rampBetween(
          1 - clamp01(finaleAway),
          i * 0.12,
          0.55 + i * 0.12,
        );
        pledges[i].style.opacity = p.toFixed(3);
        pledges[i].style.setProperty("--pop", (1 - p).toFixed(3));
      }
    };

    const requestPaint = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    };

    const onGeometry = () => {
      measure();
      paint();
    };

    let ro: ResizeObserver | null = null;
    try {
      // Turning enhancement on changes the track's height, so measure AFTER.
      root.dataset.enhanced = "true";
      measure();
      paint();

      window.addEventListener("scroll", requestPaint, { passive: true });
      window.addEventListener("resize", onGeometry, { passive: true });
      window.addEventListener("orientationchange", onGeometry, {
        passive: true,
      });
      document.addEventListener("visibilitychange", onGeometry);
      if (typeof ResizeObserver === "function") {
        ro = new ResizeObserver(onGeometry);
        ro.observe(track);
        ro.observe(stage);
      }
    } catch {
      // Enhancement must never be able to hide the story: fall back to the
      // plain document rather than leaving scenes stacked and transparent.
      root.dataset.enhanced = "false";
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestPaint);
      window.removeEventListener("resize", onGeometry);
      window.removeEventListener("orientationchange", onGeometry);
      document.removeEventListener("visibilitychange", onGeometry);
      ro?.disconnect();

      // Hand every node back to the stylesheet, visible and un-transformed.
      root.dataset.enhanced = "false";
      root.removeAttribute("data-active-scene");
      for (const el of [
        ...scenes,
        ...copies,
        ...medias,
        ...panels,
        ...ticks,
        ...pledges,
        bar,
        neutral,
        smiling,
      ]) {
        if (!el) continue;
        el.removeAttribute("style");
        el.removeAttribute("data-active");
        el.removeAttribute("aria-hidden");
      }
    };
  }, [reduced]);

  return (
    <section
      ref={rootRef}
      className={styles.section}
      id="idea"
      // Flipped to "true" by the controller once it has bound. Only that
      // attribute turns on the sticky presentation — so no-JS, a failed
      // hydration, a throw, and reduced motion all land on the plain
      // document below, which is readable exactly as written.
      data-enhanced="false"
    >
      {/* data-track / data-stage are the two measurements the whole section
          is derived from (see trackProgress). They are attributes rather than
          hashed CSS-module class names so a test can compute the exact scroll
          position of any progress value. */}
      <div className={styles.track} ref={trackRef} data-track>
        <div className={styles.stage} ref={stageRef} data-stage>
          {/* ── scene 0 — the opening statement. The white surface is five
              curtain panels; their lift is a pure function of how far past
              this scene the story has travelled, so it wipes away going down
              and wipes back going up. It is never unmounted. */}
          <div className={styles.scene} data-scene data-scene-kind="statement">
            <div className={styles.curtain} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={styles.curtainPanel}
                  data-curtain-panel
                />
              ))}
            </div>
            <div className={styles.statementCopy} data-scene-copy>
              <h2 className={styles.statement}>
                <span>This</span>
                <span className={styles.photoMask}>
                  <img
                    className={styles.photo}
                    src="/assets/Evan_main.webp"
                    alt="Evan"
                    width={1063}
                    height={1153}
                    decoding="async"
                    data-photo-neutral
                  />
                  {/* Stacked at identical dimensions and position, so the
                      crossfade between them cannot move the layout. */}
                  <img
                    className={`${styles.photo} ${styles.photoSmiling}`}
                    src="/assets/Evan_main_smiling.webp"
                    alt=""
                    aria-hidden="true"
                    width={1063}
                    height={1153}
                    decoding="async"
                    data-photo-smiling
                  />
                </span>
                <span>is Evan…</span>
              </h2>
            </div>
          </div>

          {/* ── scenes 1–4 — the beats */}
          {beats.map((beat, i) => (
            <div
              key={beat.title}
              className={`${styles.scene} ${styles.sceneBeat}`}
              data-scene
              data-scene-kind="beat"
            >
              <div className={styles.beatMedia} data-scene-media>
                {/* Posture is the browser's job: one <picture>, two sources,
                    no resize listener and no remount to swap a URL. */}
                <picture>
                  <source media="(max-width: 700px)" srcSet={beat.mobile} />
                  <img
                    className={styles.beatImg}
                    src={beat.desktop}
                    alt={beat.alt}
                    width={906}
                    height={862}
                    decoding="async"
                    loading={i === 0 ? undefined : "lazy"}
                  />
                </picture>
              </div>
              <div className={styles.beatCopy} data-scene-copy>
                <h3 className={styles.headline}>{beat.title}</h3>
                <p className={styles.copyBody}>{beat.body}</p>
              </div>
            </div>
          ))}

          {/* ── scene 5 — the finale. Reachable and clickable at the end of
              the track, where its distance is 0. */}
          <div
            className={`${styles.scene} ${styles.sceneFinale}`}
            data-scene
            data-scene-kind="finale"
          >
            <div className={styles.finaleCopy} data-scene-copy>
              <span className={styles.pledgeStack} aria-hidden="true">
                {[2, 1, 0].map((n) => (
                  <img
                    key={n}
                    className={styles.pledgeCard}
                    data-pledge={n}
                    data-pledge-card
                    src="/assets/pledge.webp"
                    alt=""
                    width={316}
                    height={143}
                    decoding="async"
                    loading="lazy"
                  />
                ))}
              </span>
              <a
                href={siteConfig.founderUrl}
                className={styles.cta}
                data-hover="primary"
              >
                Start campaign
              </a>
            </div>
          </div>

          {/* The progress bar belongs to the stage, not the viewport: it
              rides the sticky stage in and out with the section instead of
              being a globally fixed element that has to be told when to
              hide. */}
          <div className={styles.progress} data-progress aria-hidden="true">
            {TICK_KEYS.map((k) => (
              <span key={k} className={styles.tick} data-tick />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
