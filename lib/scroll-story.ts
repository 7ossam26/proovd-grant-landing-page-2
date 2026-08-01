/**
 * lib/scroll-story.ts — the scroll story's arithmetic, and nothing else.
 *
 * THE ARCHITECTURE, in one line:
 *
 *     native browser scroll → section progress → story position → visual state
 *
 * Every function here is pure: numbers in, numbers out. No DOM, no window, no
 * state, no timers. That is the whole point — the section that consumes these
 * (components/evan-section.tsx) owns exactly one piece of mutable state (the
 * cached geometry), and everything a visitor SEES is recomputed from the live
 * scroll position on the frame it is painted.
 *
 * WHY IT IS SHAPED THIS WAY. The previous engine kept the story's position in
 * its own variables — a virtual scroll under a pinned <body>, smoothed chase
 * targets, latched "active step" state, animation callbacks that advanced the
 * story, and timers that advanced it again if the callbacks didn't. Each of
 * those was a second opinion about where the visitor was, and they could
 * disagree: a fast fling, a scrollbar drag, a resize, a backgrounded tab or a
 * reversed gesture would settle one system and not the others, and the screen
 * would show a beat the page was no longer on. Deriving everything from
 * `scrollY` deletes the disagreement by construction — there is only one
 * opinion left, and the browser owns it.
 *
 * The consequence worth stating plainly: these functions are total. Hand them
 * ANY progress value in any order — 0, then 1, then 0.28 — and they return the
 * correct visual state for it. There is no "current" anything to get out of
 * sync, so a scrollbar jump is not a special case, and neither is reversing.
 * That is why the tests can drive them in a deliberately jumbled sequence.
 */

/**
 * Clamp to the unit interval.
 *
 * Written as "above zero?" rather than "below zero?" on purpose, which buys
 * two things beyond the clamp: NaN falls to 0 instead of propagating (a NaN
 * progress would otherwise reach the DOM as `opacity: NaN`, which browsers
 * drop — leaving a scene stuck at whatever it last was), and -0 normalises to
 * +0 so no derived value carries a negative zero around.
 */
export const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);

/** Hermite smoothstep on an already-clamped 0..1 input. */
export const smoothstep = (v: number): number => v * v * (3 - 2 * v);

/**
 * How far through its own scroll track the section is, 0 → 1.
 *
 * `rectTop` is the track's `getBoundingClientRect().top`: 0 when the track's
 * top edge sits at the viewport top, negative once it has passed above it. The
 * usable travel is the track's height minus the sticky stage's — the stage is
 * pinned for exactly that distance, and past it the track's bottom takes the
 * stage back off the screen.
 *
 * Guards `available` at 1px so a not-yet-laid-out section (every dimension 0,
 * which is what jsdom and a pre-paint first frame both report) yields 0 rather
 * than NaN or Infinity.
 */
export function trackProgress(
  rectTop: number,
  trackHeight: number,
  stageHeight: number,
): number {
  const available = Math.max(trackHeight - stageHeight, 1);
  return clamp01(-rectTop / available);
}

/**
 * Progress → position along the story, in scenes: 0 is the first scene dead
 * centre, `sceneCount - 1` is the last. Fractional values are the transitions,
 * which is what makes every in-between state derivable instead of animated.
 */
export function storyPositionAt(progress: number, sceneCount: number): number {
  if (sceneCount <= 1) return 0;
  return clamp01(progress) * (sceneCount - 1);
}

/**
 * The one active scene. Rounding is deliberate: it makes the active marker
 * flip exactly at the midpoint between two scenes, which is the same place the
 * crossfade hands over — so the `data-active` attribute and the scene the eye
 * calls dominant can never disagree. (They used to, and that disagreement is
 * what "the visual scene and the internally active scene disagree" describes.)
 */
export function activeSceneIndex(
  storyPosition: number,
  sceneCount: number,
): number {
  if (sceneCount <= 0) return 0;
  const rounded = Math.round(storyPosition);
  return rounded < 0 ? 0 : rounded > sceneCount - 1 ? sceneCount - 1 : rounded;
}

/** Everything one scene needs to paint itself, derived from its distance. */
export type SceneVisual = {
  /** Copy opacity — sharp, so only one scene reads at a time. */
  copyOpacity: number;
  /** Media opacity — linear, so a crossfading pair always sums to ~1. */
  mediaOpacity: number;
  /** px of vertical travel; sign follows the scroll direction. */
  translateY: number;
  /** Media scale — a hair of depth as a scene arrives and leaves. */
  scale: number;
  /** Is the scene worth rendering at all? */
  visible: boolean;
  /** May it be clicked? Exactly one scene is interactive at a time. */
  interactive: boolean;
};

/**
 * How much of the copy's fade the scene has left by the time its neighbour is
 * half a beat away. Tighter than the media's linear ramp on purpose: two
 * half-lit headlines stacked on one another is unreadable, whereas two images
 * at 50% in the SAME box is just a crossfade. Hence two curves off one
 * distance rather than one shared value.
 */
const COPY_FALLOFF = 0.62;

/** px the copy travels across a whole beat. Small — the crossfade carries the
 *  change; the drift only gives it a direction. */
const TRAVEL = 44;

/**
 * A scene's complete visual state, from its signed distance to the story
 * position (`storyPosition - sceneIndex`). Negative = the story has moved past
 * it, positive = it is still ahead.
 *
 * Every value is an even function of the distance except `translateY`, whose
 * sign carries the travel direction — which is the entire reason reversing
 * works for free: scroll back up and the distance changes sign, so the scene
 * re-enters from the side it left toward.
 */
export function sceneVisualAt(distance: number): SceneVisual {
  const away = Math.abs(distance);
  const copyOpacity = smoothstep(clamp01(1 - away / COPY_FALLOFF));
  const mediaOpacity = clamp01(1 - away);
  const travel = distance * -TRAVEL;
  return {
    copyOpacity,
    mediaOpacity,
    translateY: travel === 0 ? 0 : travel, // never hand out a negative zero
    scale: 1 - Math.min(away, 1) * 0.04,
    // A scene stops being drawn once neither layer can contribute a pixel.
    visible: away < 1,
    // Strictly one scene at a time: |distance| < 0.5 partitions the line, so
    // no two scenes can both claim the pointer, and nothing invisible can sit
    // over a button and eat the click.
    interactive: away < 0.5,
  };
}

/**
 * One curtain panel's travel, 0 (down, covering) → 1 (lifted clear).
 *
 * Panels are staggered by index so the wipe reads as a sweep rather than a
 * shutter, but the stagger is folded into the SAME progress value rather than
 * into a delay — so dragging the scrollbar backwards puts every panel exactly
 * where it was on the way up. A delay-based stagger cannot do that; it only
 * knows how to play forward.
 */
export function curtainPanelProgress(
  curtainProgress: number,
  index: number,
  step = 0.05,
): number {
  const delay = index * step;
  return clamp01((curtainProgress - delay) / Math.max(1 - delay, 0.0001));
}

/**
 * Remap a slice of the story onto its own 0..1 ramp.
 *
 * Used for the beats that live inside a scene rather than between scenes — the
 * smile crossfade, the curtain lift, the progress bar's fade. Same reversible
 * arithmetic as everything else, just over a sub-range.
 */
export function rampBetween(value: number, from: number, to: number): number {
  return clamp01((value - from) / Math.max(to - from, 0.0001));
}
