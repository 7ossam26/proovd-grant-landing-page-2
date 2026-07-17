import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollToPlugin);

/* One shared glide for EVERY committed scroll on the page — the hero,
   the Evan section's exit, and the creators/risk/days boundary helpers.

   Why shared: each helper keeping its own committing flag meant the
   momentum tail left over from one glide would land, release input, and
   immediately trip the NEXT boundary's helper — one flick chained glides
   across several sections (or clean to the top of the page).

   The gate below is how a landing's tail is told apart from the user's
   next deliberate gesture:
   - during the glide, input is held outright;
   - right after landing (FRESH_MS) every same-direction tick is tail, no
     exceptions — strong flings still tick hard here;
   - after that, the tail has to keep DECAYING: a tick has to stay under a
     decaying envelope of recent magnitudes. A spike above it is a fresh
     flick and commits immediately;
   - a pause of GAP_MS ends the gesture — the next tick is deliberate;
   - a direction flip is always deliberate (tails never reverse).
   The window self-extends while tail ticks keep arriving, so even long,
   laggy, stuttering tails die at the section they landed on. */

const SETTLE_MS = 450; // tail window after a landing (self-extending)
const FRESH_MS = 200; // just landed — same-direction ticks are always tail
const GAP_MS = 220; // input quiet this long = the gesture is over
const HARD_TICK = 110; // spikes below this never cut through the settle
const FLIP_TICK = 30; // a reversal smaller than this is lift-off jitter

const INTENT_TICK = 30; // accumulated |deltaY| that reads as a real gesture
const INTENT_GAP = 250; // stream quiet this long = start counting fresh

let accVal = 0;
let accAt = 0;

/** Trackpads scroll in tiny pixel deltas — a single tick proves nothing,
 *  but IGNORING small ticks let gentle trackpad scrolling drift natively
 *  across every boundary (and straight past the Evan sequence). Steering
 *  handlers hold every in-region tick and feed it through this instead:
 *  it answers true once the stream adds up to a deliberate gesture (one
 *  mouse notch clears it instantly). Stray jitter never accumulates — the
 *  count resets on a pause or a direction change. */
export function intentTick(e: WheelEvent): boolean {
  const now = performance.now();
  if (now - accAt > INTENT_GAP || Math.sign(accVal) !== Math.sign(e.deltaY)) {
    accVal = 0;
  }
  accAt = now;
  accVal += e.deltaY;
  if (Math.abs(accVal) >= INTENT_TICK) {
    accVal = 0;
    return true;
  }
  return false;
}

let committing = false;
let settleDir = 0;
let settleUntil = 0;
let landedAt = 0;
let lastTickAt = 0;
let envelope = 0; // decaying |deltaY| ceiling of the dying tail

const blockInput = (e: Event) => e.preventDefault();
const holdInput = () => {
  window.addEventListener("wheel", blockInput, { passive: false });
  window.addEventListener("touchmove", blockInput, { passive: false });
};
const releaseInput = () => {
  window.removeEventListener("wheel", blockInput);
  window.removeEventListener("touchmove", blockInput);
  committing = false;
};

/** True while a committed glide is in flight. */
export function glideBusy() {
  return committing;
}

/** Committed glide to a scroll position. `dir` is the wheel direction that
 *  asked for it (1 = down, -1 = up) — the landing's settle window uses it
 *  to tell tail ticks from a deliberate reversal. */
export function glideTo(to: number, dir: 1 | -1) {
  committing = true;
  holdInput();
  gsap.to(window, {
    scrollTo: { y: to, autoKill: false },
    duration: 0.4,
    ease: "power2.inOut",
    overwrite: "auto",
    onComplete: () => {
      releaseInput();
      const now = performance.now();
      settleDir = dir;
      settleUntil = now + SETTLE_MS;
      landedAt = now;
      lastTickAt = now;
      envelope = 400; // strong flings still tick big right after landing
    },
    onInterrupt: releaseInput,
  });
}

/* several handlers gate the same wheel event — compute the verdict once */
let lastEvent: WheelEvent | null = null;
let lastVerdict = false;

/** First line of every scroll-steering wheel handler. Returns true when
 *  the event was swallowed — a glide is in flight, or this tick is the
 *  momentum tail of the glide that just landed. */
export function glideGate(e: WheelEvent): boolean {
  if (e === lastEvent) return lastVerdict;
  lastEvent = e;
  lastVerdict = gate(e);
  return lastVerdict;
}

function gate(e: WheelEvent): boolean {
  if (committing) {
    e.preventDefault();
    return true;
  }
  const now = performance.now();
  if (now >= settleUntil) return false;

  const dir = e.deltaY > 0 ? 1 : -1;
  const mag = Math.abs(e.deltaY);
  const gap = now - lastTickAt;

  // tails never reverse — but a reversal has to be a real gesture; tiny
  // reversed ticks are lift-off jitter and committing on one made the page
  // glide the OPPOSITE way the user scrolled
  const flipped = dir !== settleDir && mag >= FLIP_TICK;
  const paused = gap >= GAP_MS; // the old gesture already died out
  const spiked =
    now - landedAt >= FRESH_MS && mag > Math.max(HARD_TICK, envelope * 1.5);

  if (flipped || paused || spiked) {
    settleUntil = 0; // deliberate — hand the event to the helpers
    return false;
  }

  e.preventDefault();
  lastTickAt = now;
  if (dir === settleDir) envelope = Math.max(mag, envelope * 0.8);
  settleUntil = now + SETTLE_MS;
  return true;
}
