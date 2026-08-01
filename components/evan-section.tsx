"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getIntroChoice, whenIntroDone } from "@/lib/intro";
import { siteConfig } from "@/lib/site-config";
import styles from "./evan-section.module.css";

type Mode = "idea" | "product";

type StoryCopy = {
  alt: string;
  title: string;
  body: string;
};

type StoryImage = {
  src: string;
  width: number;
  height: number;
};

type StoryBeat = StoryCopy & {
  desktopImg: StoryImage;
  mobileImg: StoryImage;
};

const IDEA_COPY: StoryCopy[] = [
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
    body:
      "A partner YouTuber with 80K subscribers shares it. Evan builds and pays nothing upfront.",
  },
  {
    alt: "Evan relaxing with the money the campaign raised",
    title: "Evan starts building",
    body: "Enough people say yes. He builds for customers who already bought.",
  },
];

const PRODUCT_COPY: StoryCopy[] = [
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

const DESKTOP_IMAGES = [
  { src: "/assets/Evan_idea_desktop.webp", width: 1115, height: 1165 },
  {
    src: "/assets/even_saying_idea_desktop.webp",
    width: 1225,
    height: 1165,
  },
  { src: "/assets/campaign_evan_desktop.webp", width: 1225, height: 1165 },
  { src: "/assets/Money_Evan_desktop.webp", width: 1225, height: 1165 },
];

const MOBILE_IMAGES = [
  { src: "/assets/Evan_idea_mobile.webp", width: 1118, height: 618 },
  { src: "/assets/even_saying_idea_mobile.webp", width: 1118, height: 618 },
  { src: "/assets/campaign_evan_mobile.webp", width: 1118, height: 618 },
  { src: "/assets/money_evan_mobile.webp", width: 1118, height: 618 },
];

const DESKTOP_PRODUCT_IMAGES = [
  { src: "/assets/Product_evan_desktop.webp", width: 1225, height: 1165 },
  ...DESKTOP_IMAGES.slice(1),
];

const MOBILE_PRODUCT_IMAGES = [
  { src: "/assets/Product_evan_mobile.webp", width: 1118, height: 618 },
  ...MOBILE_IMAGES.slice(1),
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothstep = (from: number, to: number, value: number) => {
  if (from === to) return value < from ? 0 : 1;
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

function buildStory(mode: Mode): StoryBeat[] {
  const copy = mode === "product" ? PRODUCT_COPY : IDEA_COPY;
  const desktop =
    mode === "product" ? DESKTOP_PRODUCT_IMAGES : DESKTOP_IMAGES;
  const mobile = mode === "product" ? MOBILE_PRODUCT_IMAGES : MOBILE_IMAGES;

  return copy.map((beat, index) => ({
    ...beat,
    desktopImg: desktop[index],
    mobileImg: mobile[index],
  }));
}

function StoryPicture({ beat, eager }: { beat: StoryBeat; eager: boolean }) {
  return (
    <picture>
      <source
        media="(max-width: 700px)"
        srcSet={beat.mobileImg.src}
        width={beat.mobileImg.width}
        height={beat.mobileImg.height}
      />
      <img
        className={styles.sceneImg}
        src={beat.desktopImg.src}
        alt={beat.alt}
        width={beat.desktopImg.width}
        height={beat.desktopImg.height}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
      />
    </picture>
  );
}

/**
 * Evan is a native-scroll story.
 *
 * The section supplies scroll distance, CSS keeps the stage centred with
 * position: sticky, and one rAF-coalesced reader maps geometry to a reversible
 * timeline. Nothing here writes scrollY, intercepts wheel/touch input, pins
 * the body, or plays a timer-driven sequence after the visitor has moved on.
 */
export function EvanSection() {
  const rootRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>("idea");
  const beats = buildStory(mode);

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

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      root.dataset.motion = "reduced";
      return () => {
        root.removeAttribute("data-motion");
      };
    }

    const stage = root.querySelector<HTMLElement>("[data-ev-stage]");
    const sceneEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-beat]"),
    );
    const curtainEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-curtain]"),
    );
    const tickEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-tick]"),
    );
    const progressEl = root.querySelector<HTMLElement>("[data-ev-progress]");
    const neutralPhoto = root.querySelector<HTMLElement>("[data-ev-neutral]");
    const smilingPhoto = root.querySelector<HTMLElement>("[data-ev-smile]");

    if (!stage || sceneEls.length < 2) return;

    let frame = 0;
    let destroyed = false;
    let activeScene = -1;

    const paint = () => {
      frame = 0;
      if (destroyed) return;

      const rect = root.getBoundingClientRect();
      const travel = Math.max(1, root.offsetHeight - stage.offsetHeight);
      const progress = clamp01(-rect.top / travel);
      const story = progress * (sceneEls.length - 1);
      const nextActive = Math.max(
        0,
        Math.min(sceneEls.length - 1, Math.round(story)),
      );

      root.style.setProperty("--ev-progress", progress.toFixed(5));
      root.style.setProperty("--ev-story", story.toFixed(5));

      sceneEls.forEach((scene, index) => {
        const signedDistance = story - index;
        const distance = Math.abs(signedDistance);
        const opacity = 1 - smoothstep(0.34, 0.72, distance);
        const direction = signedDistance < 0 ? 1 : -1;
        const travelY = direction * smoothstep(0.18, 0.95, distance) * 34;
        const scale = 0.965 + opacity * 0.035;

        scene.style.opacity = opacity.toFixed(4);
        scene.style.transform =
          `translate3d(0, ${travelY.toFixed(2)}px, 0) ` +
          `scale(${scale.toFixed(4)})`;
        scene.style.visibility = opacity > 0.002 ? "visible" : "hidden";
        scene.style.pointerEvents = index === nextActive ? "auto" : "none";
      });

      if (nextActive !== activeScene) {
        activeScene = nextActive;
        root.dataset.activeScene = String(activeScene);
        sceneEls.forEach((scene, index) => {
          const active = index === activeScene;
          scene.toggleAttribute("data-active", active);
          scene.setAttribute("aria-hidden", active ? "false" : "true");
        });
      }

      // The opening statement remains a full-screen white moment, but its
      // handoff is tied to scroll position: five panels lift in sequence and
      // reverse perfectly when the visitor scrolls back.
      curtainEls.forEach((curtain, index) => {
        const panelProgress = clamp01((story - 0.42 - index * 0.055) / 0.42);
        curtain.style.transform = `translate3d(0, ${(-102 * panelProgress).toFixed(2)}%, 0)`;
      });

      if (neutralPhoto && smilingPhoto) {
        const smileIn = smoothstep(0.12, 0.34, story);
        const smileOut = 1 - smoothstep(0.58, 0.82, story);
        smilingPhoto.style.opacity = (smileIn * smileOut).toFixed(4);
        neutralPhoto.style.opacity = (
          1 - smoothstep(0.18, 0.42, story)
        ).toFixed(4);
      }

      if (progressEl) {
        progressEl.style.opacity = smoothstep(0.72, 0.96, story).toFixed(4);
      }

      tickEls.forEach((tick, index) => {
        const fill = clamp01(story - index);
        tick.style.setProperty("--fill", fill.toFixed(4));
      });
    };

    const schedulePaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    root.dataset.enhanced = "true";
    paint();

    window.addEventListener("scroll", schedulePaint, { passive: true });
    window.addEventListener("resize", schedulePaint, { passive: true });
    window.addEventListener("orientationchange", schedulePaint);
    document.addEventListener("visibilitychange", schedulePaint);

    const resizeObserver = new ResizeObserver(schedulePaint);
    resizeObserver.observe(root);
    resizeObserver.observe(stage);

    return () => {
      destroyed = true;
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedulePaint);
      window.removeEventListener("resize", schedulePaint);
      window.removeEventListener("orientationchange", schedulePaint);
      document.removeEventListener("visibilitychange", schedulePaint);

      root.removeAttribute("data-enhanced");
      root.removeAttribute("data-active-scene");
      root.style.removeProperty("--ev-progress");
      root.style.removeProperty("--ev-story");

      for (const scene of sceneEls) {
        scene.style.removeProperty("opacity");
        scene.style.removeProperty("transform");
        scene.style.removeProperty("visibility");
        scene.style.removeProperty("pointer-events");
        scene.removeAttribute("data-active");
        scene.removeAttribute("aria-hidden");
      }
      for (const curtain of curtainEls) {
        curtain.style.removeProperty("transform");
      }
      for (const tick of tickEls) tick.style.removeProperty("--fill");
      progressEl?.style.removeProperty("opacity");
      neutralPhoto?.style.removeProperty("opacity");
      smilingPhoto?.style.removeProperty("opacity");
    };
  }, [mode]);

  return (
    <section ref={rootRef} className={styles.section} id="idea">
      <div className={styles.track}>
        <div className={styles.stage} data-ev-stage>
          <div className={styles.curtains} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed panel order is its identity
                key={index}
                className={styles.curtain}
                data-ev-curtain
              />
            ))}
          </div>

          <article
            className={`${styles.beat} ${styles.statementBeat}`}
            data-ev-beat
          >
            <h2 className={styles.statement}>
              <span>This</span>
              <span className={styles.portrait}>
                <img
                  className={styles.portraitImg}
                  src="/assets/Evan_main.webp"
                  alt="Evan"
                  width={1063}
                  height={1153}
                  decoding="async"
                  data-ev-neutral
                />
                <img
                  className={`${styles.portraitImg} ${styles.portraitSmiling}`}
                  src="/assets/Evan_main_smiling.webp"
                  alt=""
                  aria-hidden="true"
                  width={1063}
                  height={1153}
                  decoding="async"
                  data-ev-smile
                />
              </span>
              <span>is Evan…</span>
            </h2>
          </article>

          {beats.map((beat, index) => (
            <article
              key={beat.title}
              className={`${styles.beat} ${styles.storyBeat}`}
              data-ev-beat
            >
              <div className={styles.beatInner}>
                <div className={styles.mediaFrame}>
                  <StoryPicture beat={beat} eager={index === 0} />
                </div>
                <div className={styles.copy}>
                  <p className={styles.eyebrow} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className={styles.headline}>{beat.title}</h3>
                  <p className={styles.body}>{beat.body}</p>

                  {index === beats.length - 1 && (
                    <div className={styles.finale}>
                      <span className={styles.pledgeStack} aria-hidden="true">
                        {[2, 1, 0].map((card) => (
                          <img
                            key={card}
                            className={styles.pledgeCard}
                            data-card={card}
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
                  )}
                </div>
              </div>
            </article>
          ))}

          <div
            className={styles.progress}
            data-ev-progress
            aria-hidden="true"
          >
            {beats.map((beat) => (
              <span
                key={beat.title}
                className={styles.tick}
                data-ev-tick
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
