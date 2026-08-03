"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  armIntroDeadline,
  claimIntro,
  finishIntro,
  introSettled,
  releaseIntroClaim,
  setIntroChoice,
  whenIntroDismissed,
} from "@/lib/intro";
import styles from "./intro-gate.module.css";

/**
 * Full-screen entry gate — the first screen on load, sitting above the
 * navbar. Two choices on a deep-navy field (hsl(231 100% 3%), per spec);
 * each tile carries the screen texture as a multiply overlay.
 *
 * The whole intro, end to end:
 *
 *   load → a 0→100% count with the crank clip looping above it (~1.8s,
 *   decorative), then the two tiles take the stage
 *   → pick → the picked tile strobes 3x and the OTHER one shuts, its width
 *   closing from both edges while its grid row goes 1fr → 0fr, so the picked
 *   tile glides to the middle of the screen rather than jumping there
 *   → the picked tile then takes the SAME exit (the identical
 *   `.tile[data-closing]` rule, one beat later, with the flash delay taken
 *   out) → a muted full-screen stinger fades up over the navy and plays
 *   → its last frame is cut away, revealing the hero image already painted
 *   underneath → the hero's own reveal runs, unchanged.
 *
 * All of the choreography is CSS, keyed off `data-phase` on the root; this
 * component only advances the phase and drives the video element.
 *
 * The handoff to <Hero /> is lib/intro.ts — one promise that can only
 * resolve, plus the timers that guarantee it does. Note that the gate hides
 * itself off that SAME promise: whatever ends the intro (the clip, a failure
 * path, or the module's own deadline) removes this overlay and releases the
 * hero as a single event, so the two can never disagree.
 */

type Choice = { key: "idea" | "product"; label: string };

/** Source order IS row order: intro-gate.module.css collapses row 1 or row 2
 *  by key (`.choices[data-picked="…"]`), so reordering means editing that. */
const CHOICES: Choice[] = [
  { key: "idea", label: "I have an Idea" },
  { key: "product", label: "I have a product" },
];

/** The gate's states, in order. `loading` is the pre-choice loader — a
 *  0→100% count with the crank clip looping on top — and the tiles take the
 *  stage at `choosing`. `gone` is `display: none` — the sequence is finished
 *  but the component stays mounted so the hook order never moves. */
type Phase =
  | "loading"
  | "choosing"
  | "picked"
  | "sealing"
  | "playing"
  | "done"
  | "gone";

/** The stinger, one file per posture. */
const CLIP = {
  /** 1920x1080, 0.97s (~560 KB after the owner's re-encode). */
  desktop: "/assets/desktop-video.mp4",
  /** 1080x1920, 1.37s — portrait, shot for the phone posture. Before this
   *  existed phones were served the 16:9 desktop clip and `cover` reduced it
   *  to a narrow strip of its own middle. */
  phone: "/assets/mobile-video.mp4",
} as const;

/** The posture line — the same 700px breakpoint every other section uses. */
const PHONE_QUERY = "(max-width: 700px)";

/** The pre-choice loader (owner: "a simple text animation 0 to 100% loader
 *  before the buttons and add this ontop of it in a loop", then "the loader
 *  should not be finished before everything else is loaded"): the count
 *  climbs to 90% over LOAD_MIN_MS, HOLDS there until the page's assets are
 *  actually in — window `load`, the crank clip's first frame, the stinger's
 *  buffer — then runs to 100. The first live deploy proved why: a fixed
 *  1.8s count outran the crank's own 768 KB fetch, so the clip never
 *  painted before the tiles arrived ("the loading crank video doesn't show
 *  up"). Everything is raced against LOAD_MAX_MS, so a dead asset costs the
 *  cap at worst, never the gate. Skipped under reduced motion. */
const CRANK_SRC = "/assets/crank-load.mp4";
const LOAD_MIN_MS = 1500; // the 0→90 climb (also the floor on a warm cache)
const LOAD_DONE_MS = 320; // the 90→100 run once the assets are in
const LOAD_MAX_MS = 8000; // no asset may hold the tiles longer than this
const LOAD_TAIL = 250; // beat of rest at 100% before the tiles come up

/** HTMLMediaElement.HAVE_ENOUGH_DATA, spelled out so no environment has to
 *  supply the constant. Anything less and a half-megabyte file would be
 *  playing half-downloaded through its own 0.97s runtime. */
const BUFFERED = 4;

/** Milliseconds, mirroring the CSS clock in intro-gate.module.css. */
const T = {
  /** pick → the loser has finished shutting (--shut-delay + --shut) */
  seal: 760,
  /** the winner's own shut (--shut, with --shut-delay zeroed for it) */
  cut: 520,
  /** how long we wait for the clip to buffer before giving up on it */
  buffer: 1200,
  /** ceiling on a 0.97s clip: a missing 'ended', a stall, a hidden tab */
  video: 2200,
  /** ceiling on the hero decode hold — invisible, the gate is still opaque */
  decode: 900,
  /** phase done → phase gone; ≥ the longest --exit (0.28s) */
  exit: 340,
} as const;

/** The flash is `animation: none` under reduced motion, so `animationend`
 *  never fires there and a `data-flashing` set now would stick for the rest
 *  of the session. Read the preference and skip the state. */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Save-Data only: a decorative 1.6 MB stinger is not worth a metered
 *  megabyte when the visitor has explicitly asked us not to spend one.
 *  Chromium-only — there is no cross-browser signal — so this is a partial
 *  mitigation, not a guarantee.
 *
 *  Deliberately NOT keyed on `effectiveType`. That was measured misfiring:
 *  Chrome's estimate is cold at page load and reports "2g"/"slow-2g" before
 *  it settles, so the clip was being denied on a LOCAL dev server — and on
 *  real visitors whose estimate is momentarily pessimistic. Connection speed
 *  is already handled by a measured signal instead of a guessed one: the clip
 *  gets T.buffer to reach HAVE_ENOUGH_DATA and is dropped if it can't, which
 *  is the same protection without the false positives. */
function wantsLessData() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  return c?.saveData === true;
}

/** Never hand a black screen to a browser that cannot decode H.264. The
 *  bare `video/mp4` fallback is deliberate: probing only an explicit
 *  Baseline codec string would falsely reject a High-profile file on a
 *  pedantic UA. jsdom returns "" for both, which is a second, independent
 *  reason none of the media machinery is reachable in unit tests. */
/** Tablets/iPads get components/tablet-block.tsx instead of the site, so the
 *  intro is behind an opaque cover there and must not spend 1.6 MB on a clip
 *  nobody will see. KEEP IN SYNC with tablet-block.module.css. */
const TABLET_QUERY =
  "(min-width: 701px) and (max-width: 1023px)," +
  "(min-width: 701px) and (pointer: coarse)," +
  "(min-width: 701px) and (max-height: 599px)";

function canPlayMp4() {
  try {
    const probe = document.createElement("video");
    if (typeof probe.canPlayType !== "function") return false;
    return (
      probe.canPlayType('video/mp4; codecs="avc1.42E01E"') !== "" ||
      probe.canPlayType("video/mp4") !== ""
    );
  } catch {
    return false;
  }
}

export function IntroGate() {
  // Which tile is mid-flash. Cleared on animationend so a later press can
  // re-flash the same tile (removing the attribute lets the CSS animation
  // restart on the next render).
  const [flashing, setFlashing] = useState<Choice["key"] | null>(null);
  // Which tile was chosen. Sticky — the first press wins and the other tile
  // shuts for good; there is nothing here to re-open.
  const [picked, setPicked] = useState<Choice["key"] | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  // Did the clip actually paint? Decides hard cut vs dissolve on the way
  // out: with no frame on screen there is nothing to cut against.
  const [played, setPlayed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  /** The loader's pieces: the looping crank clip and the % readout. The
   *  count is written straight to textContent by a rAF loop — 60 state
   *  updates a second through React would be renders for nothing. */
  const crankRef = useRef<HTMLVideoElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<Phase>("loading");
  /** Did the hero art actually finish decoding before the cut? A hard cut
   *  onto an undecoded background lands on .hero's background-color —
   *  #013F17, a saturated green — against this gate's navy, i.e. exactly the
   *  colour flash the decode hold exists to prevent. Only hard-cut when the
   *  bitmap is genuinely ready; otherwise dissolve over it. */
  const heroDecodedRef = useRef(false);
  /** Did the clip reach its real end, or did the timeupdate safety net cut it
   *  early? The net fires up to 60ms short — 1.5–2 frames, and the final
   *  frames are precisely where any residual motion lives. A dissolve hides
   *  that; a hard cut would pop. */
  const cutOnEndedRef = useRef(false);
  /** The sequence, installed by the effect below. The click handler is only
   *  a trigger, so everything stateful lives in one place with one cleanup. */
  const startRef = useRef<((key: Choice["key"]) => void) | null>(null);

  // Don't restore the previous scroll position on reload. The intro is a
  // top-of-page experience and the hero→Evan scroll-jack assumes you start at
  // the hero; landing mid-page on reload skips the gate over the wrong spot
  // and fights the jack. Every load begins at the top. `manual` tells the
  // browser to stop restoring; the scrollTo(0,0) covers a reload that already
  // painted at an offset before this ran.
  useLayoutEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  useLayoutEffect(() => {
    // A second mount after the intro already ran — Fast Refresh, or React 19
    // StrictMode remounting a gate whose sequence finished. The module
    // promise is resolved for good, so the hero is already out; replaying
    // the intro would cover a page the visitor has seen. Land on `gone`.
    if (introSettled()) {
      phaseRef.current = "gone";
      setPhase("gone");
      return;
    }

    claimIntro(); // "there IS a gate — hero, wait for me"

    const video = videoRef.current;
    const reduced = prefersReducedMotion();
    let alive = true;
    let ended = false;
    let started = false;
    let painted = false;
    let clipFailed = false;
    const timers: number[] = [];
    // Deliberately NOT in `timers`: this is the one timer finish() must never
    // be able to clear. finish() calls clearTimers(), and if Escape lands
    // within T.exit of a pending timer the gate would be stuck at
    // data-phase="done" — invisible, but a permanent full-screen fixed
    // compositing layer holding an undisposed <video>.
    let exitTimer: number | undefined;

    // May the clip run at all? Decided once, here, so every downstream check
    // is a single boolean. Reduced motion is first: nobody who asked for
    // less motion gets an autoplaying full-screen video, and because this
    // also gates the preload flip below, they never pay the 1.6 MB either.
    const allowClip =
      !reduced &&
      !!video &&
      typeof video.play === "function" &&
      !wantsLessData() &&
      !window.matchMedia(TABLET_QUERY).matches &&
      canPlayMp4();

    const after = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (alive) fn();
      }, ms);
      timers.push(id);
    };
    const clearTimers = () => {
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
    };
    // The phase only ever moves FORWARD. finishIntro() can be called from
    // outside this sequence (Escape, lib/intro.ts's deadline); those paths
    // leave the pick chain running, and a stray go("sealing")/go("playing")
    // afterwards would drag this opaque overlay back over an already-revealed
    // hero — with nothing left to take it away, because whenIntroDone()'s
    // handler below runs exactly once. That is an unrecoverable trap: the
    // page stays covered and scroll-locked until a reload. The teardown in
    // that handler is the actual fix; this guard makes the invariant
    // unbreakable by any future edit, and costs one array lookup.
    const ORDER: Phase[] = [
      "loading",
      "choosing",
      "picked",
      "sealing",
      "playing",
      "done",
      "gone",
    ];
    const go = (next: Phase) => {
      if (!alive) return;
      if (ORDER.indexOf(next) <= ORDER.indexOf(phaseRef.current)) return;
      phaseRef.current = next;
      setPhase(next);
    };

    // ── THE HERO BACKGROUND.
    //
    // On the clip path we never load a still at all: the stinger's last frame
    // IS the hero, so we snapshot it out of the <video> into a <canvas> and
    // hand that to .bg. Pixel-identical by construction — there is no crop to
    // match, no decode to race, and no separate image to keep in sync when
    // the clip is re-cut. Measured in this browser: 4.2ms to grab a 1920x1080
    // frame, and the canvas is NOT tainted (same-origin file), so this is
    // cheap and legal. A held frame costs about the same GPU memory as the
    // decoded still it replaces (~8 MB either way), so this is a straight
    // saving of the still's bytes, not a trade.
    //
    // Deliberately NOT encoded to a blob/data-URL first: toBlob('image/webp')
    // on a 1080p frame measured 414ms of main-thread work here, which would
    // blow the exit window for zero benefit — a <canvas> is already a
    // paintable replaced element, and object-fit: cover crops it exactly the
    // way background-size: cover crops the still.
    const snapshotFrame = (): boolean => {
      if (!video?.videoWidth || !video.videoHeight) return false;
      // Phones snapshot too, now that CLIP.phone is a real portrait clip. It
      // used to bail here because the only clip was 16:9 and `cover` reduced
      // it to a strip of its own middle on a portrait viewport — fine for a
      // second of motion, wrong as the hero you then read over.
      const bg = document.querySelector<HTMLElement>(
        'section[aria-label="Proovd"] [data-hero-bg]',
      );
      if (!bg) return false;
      try {
        const cv = document.createElement("canvas");
        cv.width = video.videoWidth;
        cv.height = video.videoHeight;
        const ctx = cv.getContext("2d");
        if (!ctx) return false;
        ctx.drawImage(video, 0, 0);
        cv.setAttribute("aria-hidden", "true");
        // Geometry and crop come from hero.module.css (`.bg > [data-hero-frame]`),
        // NOT from here: the canvas has to crop identically to the still it
        // replaces, and one rule in one file is the only way that stays true
        // — including the right-anchoring that keeps the subject's face whole
        // at narrow widths, and the phone override.
        cv.setAttribute("data-hero-frame", "");
        bg.replaceChildren(cv);
        return true;
      } catch {
        return false; // fall through to the still
      }
    };

    // There is no fallback still any more — the owner deleted the hero art
    // outright when the asset set went webp (new_hero_desktop / Hero_mobile
    // are gone). On the paths where no clip frame can exist (reduced motion,
    // Save-Data, refused autoplay, unplayable codec, dead file) the cut now
    // lands on .hero's own background-color surface, and it always dissolves
    // there: heroDecodedRef stays false, so data-cut can never read "hard".
    // Kept as a resolved no-op so every call site's sequencing is unchanged.
    const loadStill = (): Promise<unknown> => Promise.resolve();
    // Already know there will be no frame? Start it now, while the gate is
    // still opaque, so the cut has something decoded to land on.
    if (!allowClip) loadStill();

    const onReady = () => startClip();
    const onEnded = () => {
      cutOnEndedRef.current = true; // the real last frame — safe to hard-cut
      finish();
    };
    // Attached from mount so a 404 discovered while buffering is NOTICED —
    // but it only records. Escalating to finish() here would resolve the
    // promise and dissolve the gate before the visitor ever picked a tile.
    const onMediaError = () => {
      clipFailed = true;
      if (started) finish();
    };
    // 'ended' is unreliable on sub-second clips in some engines. Cutting one
    // frame early is invisible: on desktop that frame IS the hero photo.
    const onTime = () => {
      if (!video) return;
      const d = video.duration;
      if (Number.isFinite(d) && d > 0 && video.currentTime >= d - 0.06) {
        finish();
      }
    };

    const detachVideo = () => {
      if (!video) return;
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onMediaError);
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("timeupdate", onTime);
    };

    // ── arm the element. The JSX ships `preload="none"` so the preload
    // scanner does NOT pull 1.6 MB for someone who will never see it;
    // flipping to "auto" here starts the fetch, and load() makes that
    // deterministic rather than a spec "may". We are past hydration, which
    // costs nothing against the seconds a human spends reading two buttons.
    if (allowClip && video) {
      // React does set `muted` as a property, but the autoplay policy reads
      // the property and pinning it costs nothing.
      video.defaultMuted = true;
      video.muted = true;
      video.addEventListener("error", onMediaError);
      try {
        // Posture decides the clip. Set here rather than as a JSX attribute
        // so only ONE file is ever fetched — the element ships with no src at
        // preload="none", so nothing is in flight until this line runs.
        video.src = window.matchMedia(PHONE_QUERY).matches
          ? CLIP.phone
          : CLIP.desktop;
        video.preload = "auto";
        video.load();
      } catch {
        /* no media support at all — playClip() will skip the clip */
      }
    }

    // ── the pre-choice loader. The count is REAL now (see the consts): it
    // climbs to 90 over LOAD_MIN_MS, holds until the page's assets are in,
    // then runs to 100 and the tiles take the stage. Reduced motion skips
    // straight to the tiles: a forced wait behind a counter plus an
    // autoplaying clip is exactly what that preference asked not to get. The
    // crank is gated like the stinger (Save-Data, the tablet cover, codec
    // support), but its absence only hides the clip — the count runs
    // regardless.
    const crank = crankRef.current;
    const count = countRef.current;
    let loadRaf = 0;
    let crankOn = false;
    let crankSeen: (() => void) | undefined;
    let clipSeen: (() => void) | undefined;
    const hideCrank = () => {
      if (crank) crank.style.display = "none";
    };
    const beginChoosing = () => {
      if (count) count.textContent = "100%";
      go("choosing");
      if (crankOn && crank) {
        try {
          crank.pause();
        } catch {
          /* media element already torn down */
        }
      }
    };
    if (reduced) {
      go("choosing");
    } else {
      // What "everything else" means, concretely. Each wait resolves on its
      // own failure path too — this list may only ever DELAY the tiles,
      // never hold them hostage (and the LOAD_MAX_MS race caps even that).
      const waits: Promise<unknown>[] = [];
      // 1 — the page's own subresources: stylesheets, eager images, fonts.
      if (document.readyState !== "complete") {
        waits.push(
          new Promise((resolve) => {
            window.addEventListener("load", resolve, { once: true });
          }),
        );
      }
      if (
        crank &&
        typeof crank.play === "function" &&
        !wantsLessData() &&
        !window.matchMedia(TABLET_QUERY).matches &&
        canPlayMp4()
      ) {
        // 2 — the crank's first frame, so the clip is actually VISIBLE
        // before the count can finish.
        waits.push(
          new Promise<void>((resolve) => {
            crankSeen = () => {
              crankSeen = undefined;
              resolve();
            };
            crank.addEventListener("loadeddata", () => crankSeen?.(), {
              once: true,
            });
            crank.addEventListener("error", () => crankSeen?.(), {
              once: true,
            });
          }),
        );
        crank.defaultMuted = true;
        crank.muted = true;
        crank.addEventListener("error", hideCrank);
        try {
          // Same no-src/preload="none" discipline as the stinger: nothing is
          // fetched until this client has decided to play it.
          crank.src = CRANK_SRC;
          crank.preload = "auto";
          crank.load();
          crankOn = true;
          Promise.resolve(crank.play()).catch(hideCrank);
        } catch {
          hideCrank();
          crankSeen?.();
        }
      } else {
        hideCrank(); // the count carries the loader alone
      }
      // 3 — the stinger's buffer, when one is armed (its fetch started
      // above): the pick lands on a clip that can play through.
      if (allowClip && video) {
        waits.push(
          new Promise<void>((resolve) => {
            if (video.readyState >= BUFFERED || video.error) {
              resolve();
              return;
            }
            clipSeen = () => {
              clipSeen = undefined;
              resolve();
            };
            video.addEventListener("canplaythrough", () => clipSeen?.(), {
              once: true,
            });
            video.addEventListener("error", () => clipSeen?.(), {
              once: true,
            });
          }),
        );
      }
      let assetsIn = false;
      Promise.race([
        Promise.all(waits),
        new Promise((resolve) => after(LOAD_MAX_MS, () => resolve(null))),
      ]).then(() => {
        assetsIn = true;
      });
      const t0 = performance.now();
      let finFrom = -1; // the value the 90→100 run started from…
      let finAt = 0; // …and when it started
      const step = (now: number) => {
        if (!alive || phaseRef.current !== "loading") return;
        let v: number;
        if (finFrom < 0) {
          v = 90 * Math.min(1, (now - t0) / LOAD_MIN_MS);
          // A warm cache resolves the waits instantly — the floor keeps the
          // count from flashing 0→100 in a blink and reading as broken.
          if (assetsIn && now - t0 >= LOAD_MIN_MS * 0.45) {
            finFrom = v;
            finAt = now;
          }
        } else {
          v =
            finFrom +
            (100 - finFrom) * Math.min(1, (now - finAt) / LOAD_DONE_MS);
        }
        if (count) count.textContent = `${Math.round(v)}%`;
        if (v >= 99.5) {
          after(LOAD_TAIL, beginChoosing);
          return;
        }
        loadRaf = requestAnimationFrame(step);
      };
      loadRaf = requestAnimationFrame(step);
      // rAF is suspended in a hidden tab; this timer backstop still fires, so
      // the gate can never sit at "loading" forever. after() timers are
      // cleared by the dismissal teardown, and go() only moves forward, so
      // neither path can drag a dismissed gate back.
      after(LOAD_MAX_MS + 1500, beginChoosing);
    }

    // ── THE one exit. Every success and every failure funnels through here.
    function finish() {
      if (ended) return;
      ended = true;
      clearTimers();
      detachVideo();
      // Reduced motion lands straight on the hero: no decode hold, because
      // holding an opaque navy gate for up to 0.9s is exactly what "skip the
      // intro" is supposed to avoid. .hero's background-color is the floor.
      if (reduced) {
        loadStill();
        finishIntro();
        return;
      }
      // A frame painted: the last frame IS the hero. Grabbing it is
      // synchronous (~4ms) and pixel-exact, so there is nothing to hold and
      // nothing that can fail to line up. Note this runs BEFORE the video is
      // paused or the overlay leaves, i.e. while the frame is still there.
      if (painted && snapshotFrame()) {
        heroDecodedRef.current = true;
        finishIntro();
        return;
      }
      // No frame — fall back to the still and hold the cut until it decodes.
      // Invisible (the gate is still opaque) and capped so a dead image can't
      // stall it. Deliberately NOT guarded by `alive`: if this component is
      // gone the hero must be released, not stranded behind an ownerless
      // promise.
      Promise.race([
        loadStill(),
        new Promise((r) => window.setTimeout(r, T.decode)),
      ]).then(finishIntro, finishIntro);
    }

    function startClip() {
      if (started || !alive || ended || !video) return;
      started = true;
      video.removeEventListener("canplaythrough", onReady);
      video.addEventListener("ended", onEnded, { once: true });
      video.addEventListener("timeupdate", onTime);
      // 'ended' can go missing: a stall, a backgrounded tab, a truncated
      // file. This is the hard backstop on a 0.97s clip.
      after(T.video, finish);
      // Flip the phase BEFORE play(), so the --fade ramp and frame one
      // coincide. Driving it off the play-promise instead spent ~20% of a
      // 0.97s stinger behind the ramp — invisible, then semi-transparent —
      // with a gap of bare navy after the tiles had already gone. A refused
      // play() still routes to finish(), and .video carries the same navy
      // background-color, so the worst case is the field it was showing
      // anyway; nothing white or empty can appear.
      setPlayed(true); // a frame is coming — the exit may hard-cut
      go("playing");
      let p: unknown;
      try {
        // Some older engines throw synchronously. (jsdom does NOT — it emits
        // a virtual-console "Not implemented" and returns undefined — but
        // this line is unreachable in tests either way; see CLAUDE.md.)
        p = video.play();
      } catch {
        finish();
        return;
      }
      Promise.resolve(p).then(
        () => {
          painted = true;
        },
        () => finish(), // autoplay refused (iOS Low Power Mode, policy)
      );
    }

    const playClip = () => {
      if (!alive || ended) return;
      // Not allowed, no element, a dead file, or an engine with no media
      // support at all — skip the stinger and cut.
      if (!allowClip || !video || clipFailed || video.error) {
        finish();
        return;
      }
      if (video.readyState >= BUFFERED) {
        startClip();
        return;
      }
      // Not buffered yet — wait, briefly. `started` makes the two paths
      // mutually exclusive, so the timeout can neither double-start the clip
      // nor cut off one that is already playing through a re-buffer.
      video.addEventListener("canplaythrough", onReady, { once: true });
      after(T.buffer, () => {
        if (started || ended) return;
        video.removeEventListener("canplaythrough", onReady);
        if (video.readyState >= BUFFERED && !clipFailed) startClip();
        else finish(); // drop it rather than stutter a one-second stinger
      });
    };

    startRef.current = (key) => {
      if (phaseRef.current !== "choosing") return; // the pick is final
      setIntroChoice(key); // the Evan story reads this to pick its script
      setPicked(key);
      setFlashing(reduced ? null : key);
      go("picked");
      // The module's ceiling, armed before anything else can go wrong. No
      // consumer arms this — it lives in lib/intro.ts so it can't be
      // forgotten, and it hides this overlay as well as freeing the hero.
      armIntroDeadline();
      // TODO(destination): route the choice — idea → siteConfig.founderUrl,
      // product → siteConfig.affiliateUrl. Both tiles run this same intro,
      // so only the landing changes and nothing above has to move. Act on
      // it AFTER the hero is on screen, never before: navigating out of an
      // intro the visitor cannot back out of is a trap.
      if (reduced) {
        // No strobe, no glide, and above all no full-screen autoplaying
        // video at someone who asked for less motion. The reduced-motion
        // CSS has already put both tiles at their end state, so there is
        // nothing to wait for: land on the hero now.
        finish();
        return;
      }
      after(T.seal, () => {
        go("sealing"); // the winner takes its sibling's exit
        after(T.cut, playClip);
      });
    };

    // ONE exit for the overlay, whichever thing resolved the promise: the
    // clip ending, any failure path, or the module's own deadline.
    whenIntroDismissed().then(() => {
      // TEAR THE SEQUENCE DOWN FIRST. finishIntro() can come from OUTSIDE
      // finish() — the Escape handler, lib/intro.ts's 7s deadline, any future
      // consumer. Those paths never set `ended` and never clear the pick
      // chain, so without this the queued after(T.seal)/after(T.cut) callbacks
      // keep firing after the overlay has left: go("sealing") drags this
      // opaque layer back over the revealed hero, the scroll lock re-engages,
      // the stinger plays over the page, and nothing can ever reach "done"
      // again because this handler runs exactly once. Reload-only trap.
      ended = true; // every remaining finish() is now a no-op
      clearTimers(); // cancel the whole pick chain
      detachVideo();
      // Stop decoding behind an invisible overlay during the 0.34s between
      // `done` and `gone`. Guarded on `started` so jsdom's unimplemented
      // pause() is never reached.
      if (started && video) {
        try {
          video.pause();
        } catch {
          /* media element already torn down */
        }
      }
      // The crank must not keep decoding behind an invisible overlay either
      // (reachable: Escape during the loader).
      if (crankOn && crank) {
        try {
          crank.pause();
        } catch {
          /* media element already torn down */
        }
      }
      if (!alive) return;
      go("done");
      // NOT via after(): finish() clears that array, and this timer is what
      // takes the overlay to display:none.
      exitTimer = window.setTimeout(() => {
        if (alive) go("gone");
      }, T.exit);
    });

    // ── Give the clip the HERO's box, not the viewport's. Both use `cover`,
    //    but `cover` resolves against the box it is painted into: .video sits
    //    in a position:fixed gate (the viewport), while .bg sits in .hero,
    //    which is `min-height: 100svh` — taller than the viewport whenever the
    //    hero's content overflows one screen, and sized in svh, which is not
    //    the fixed containing block on any UA with a dynamic toolbar. Two
    //    different boxes means two different crop scales, so the "match cut"
    //    would visibly zoom and shift. Publishing the hero's rect as CSS vars
    //    makes the two computations identical by construction.
    //    DOM-based cross-component wiring, per CLAUDE.md — the same idiom the
    //    navbar and Evan already use. The hero may legitimately be absent; the
    //    var() fallbacks keep full-bleed behaviour in that case.
    const gateEl = gateRef.current;
    const heroEl = document.querySelector<HTMLElement>(
      'section[aria-label="Proovd"]',
    );
    let cropRO: ResizeObserver | null = null;
    if (gateEl && heroEl) {
      const syncCrop = () => {
        const r = heroEl.getBoundingClientRect();
        gateEl.style.setProperty("--crop-w", `${r.width}px`);
        gateEl.style.setProperty("--crop-h", `${r.height}px`);
        gateEl.style.setProperty("--crop-y", `${r.top}px`);
      };
      syncCrop();
      try {
        cropRO = new ResizeObserver(syncCrop);
        cropRO.observe(heroEl);
      } catch {
        /* no ResizeObserver — the initial sync still holds */
      }
    }

    return () => {
      alive = false;
      startRef.current = null;
      clearTimers();
      if (loadRaf) cancelAnimationFrame(loadRaf);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
      cropRO?.disconnect();
      detachVideo();
      // neuter the loader's once-listeners; their promises just never
      // resolve, which is fine — nobody is waiting after unmount
      crankSeen = undefined;
      clipSeen = undefined;
      crank?.removeEventListener("error", hideCrank);
      if (started && video) {
        try {
          video.pause();
        } catch {
          /* media element already torn down */
        }
      }
      if (crankOn && crank) {
        try {
          crank.pause();
        } catch {
          /* media element already torn down */
        }
      }
      // Unmounting mid-sequence leaves the promise with nobody to resolve
      // it, so release the hero. Before the pick, though — the loader OR the
      // choice screen — an unmount is just StrictMode double-mounting (or a
      // Fast Refresh). Resolving there would settle the intro for good and
      // the remount would land on `gone`, skipping the whole gate. Hand the
      // claim back instead; the remount re-claims inside the grace window,
      // and a gate that never returns still frees the hero.
      if (phaseRef.current === "loading" || phaseRef.current === "choosing") {
        releaseIntroClaim();
      } else {
        finishIntro();
      }
      void painted; // read by the closure above; kept for the exit decision
    };
  }, []);

  // Both tiles are on their way out once the winner starts sealing.
  const sealing = phase !== "choosing" && phase !== "picked";
  // The overlay still owns the screen (and therefore the scroll position).
  const covering = phase !== "done" && phase !== "gone";

  // ── Scroll lock. The gate is a modal covering the whole page, so the page
  //    holds still while it is up; without it a scroll behind an opaque
  //    cover would dump the visitor mid-site the moment it lifts. This is a
  //    HOLD, never a write — no scroll position is ever set — so it is not a
  //    scroll authority in the CLAUDE.md sense. React owns the release: the
  //    cleanup runs on the → done transition, on unmount, and after any
  //    throw that unmounts the tree. It restores the values it captured
  //    rather than blanking them, so it cannot clobber the navbar's own
  //    body.overflow write (unreachable here — the nav is parked until
  //    scrollY > 10, which this lock makes impossible).
  useLayoutEffect(() => {
    if (!covering) return;
    const body = document.body.style;
    const root = document.documentElement.style;
    const prevOverflow = body.overflow;
    const prevOverscroll = root.overscrollBehavior;
    body.overflow = "hidden";
    root.overscrollBehavior = "none";
    return () => {
      body.overflow = prevOverflow;
      root.overscrollBehavior = prevOverscroll;
    };
  }, [covering]);

  // ── Escape always ends the intro. A full-screen opaque curtain with no
  //    keyboard way out is a trap; this is the standard modal affordance and
  //    it routes through the same single resolver as everything else. Delete
  //    this effect if the choice must be unskippable — nothing depends on it.
  useEffect(() => {
    if (!covering) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishIntro();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [covering]);

  const endFlash = useCallback((key: Choice["key"]) => {
    setFlashing((f) => (f === key ? null : f));
  }, []);

  return (
    <div
      ref={gateRef}
      className={styles.gate}
      // Server-rendered marker: lib/intro.ts reads it to answer "is there an
      // intro on this page at all?" without depending on effect ordering.
      // Keep in sync with INTRO_GATE_ATTR.
      data-intro-gate=""
      data-phase={phase}
      // Hard-cut ONLY when all three are true: a frame actually painted, the
      // hero bitmap is genuinely decoded (otherwise the cut lands on .hero's
      // green background-color against this navy — a visible colour flash),
      // and the clip reached its real end rather than being cut up to 60ms
      // short by the timeupdate net. Anything less dissolves over it. Both
      // refs are written before finishIntro() resolves, and go("done")
      // re-renders in the following microtask, so this render sees them.
      data-cut={
        played && heroDecodedRef.current && cutOnEndedRef.current
          ? "hard"
          : "soft"
      }
    >
      {/* JS off: this gate is a modal with no way out, so it must not exist —
          otherwise it traps the entire page, not just the hero. The
          stylesheet handles it with @media (scripting: none); this is the
          belt for engines that predate that feature. Raw HTML because a
          <noscript>'s children are parsed as TEXT when scripting is on, so
          React could never hydrate real elements in here — which is also why
          the hydration warning is suppressed. */}
      <noscript
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a <noscript>'s content is raw text to the parser; this is the only hydration-safe way to render it. The payload is a hashed CSS-module class name, no interpolation of anything else.
        dangerouslySetInnerHTML={{
          __html: `<style>.${styles.gate}{display:none!important}</style>`,
        }}
      />

      {/* The stinger, rendered from first paint and never conditionally, so
          the element exists in the server HTML — but with NO src and at
          preload="none", so NOT ONE BYTE is fetched until the effect above
          decides this client will play it AND which posture's clip it needs
          (CLIP.desktop vs CLIP.phone). Shipping a src here would have the
          preload scanner fetch the desktop clip on phones too. muted +
          playsInline is the only combination browsers will autoplay; we still
          handle a refusal. The effect sets `src` on the ELEMENT rather than
          adding a child <source> on purpose: a failing <source> does not fire
          a bubbling error on the media element (you get NETWORK_NO_SOURCE and
          silence), and this sequence needs that error event. */}
      <video
        ref={videoRef}
        className={styles.video}
        preload="none"
        muted
        playsInline
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* The pre-choice loader — phase "loading": the crank clip loops on
          top of a 0→100% count (owner). Purely decorative, so hidden from
          the a11y tree outright; the effect writes the number straight to
          the span. Same no-src/preload="none" discipline as the stinger:
          not one byte of the clip is fetched until the effect decides this
          client plays it. */}
      <div className={styles.loader} aria-hidden="true">
        <video
          ref={crankRef}
          className={styles.crank}
          preload="none"
          muted
          playsInline
          loop
          disablePictureInPicture
          tabIndex={-1}
        />
        <span ref={countRef} className={styles.count}>
          0%
        </span>
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: no <form> here, and a
          fieldset's UA rendering fights the stacked tiles — an ARIA group
          on a div is the cleaner grouping */}
      <div
        className={styles.choices}
        data-picked={picked ?? undefined}
        role="group"
        aria-label="Where are you at?"
      >
        {CHOICES.map((c) => {
          // A tile on its way out: the loser from the moment of the pick,
          // the winner from the sealing beat. Take it out of the tab order
          // and the a11y tree now. `inert` rather than `disabled` —
          // disabled would repaint it in UA grey mid-shut.
          const closing = picked !== null && (picked !== c.key || sealing);
          return (
            <button
              key={c.key}
              type="button"
              className={styles.tile}
              data-flashing={flashing === c.key ? "" : undefined}
              data-closing={closing ? "" : undefined}
              inert={closing}
              tabIndex={closing ? -1 : undefined}
              onClick={() => startRef.current?.(c.key)}
              onAnimationEnd={() => endFlash(c.key)}
            >
              <span className={styles.label}>{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
