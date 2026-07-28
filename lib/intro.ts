/**
 * lib/intro.ts — the intro → hero handoff.
 *
 * <IntroGate /> owns the first two seconds of the page: a two-tile choice, a
 * shut, a one-second stinger, a cut. <Hero /> reveals itself on mount. The
 * two never meet in the React tree — the gate renders beside <main>, the
 * hero inside it — so the handoff lives here: one promise, one resolver, and
 * the timers that guarantee the promise always settles.
 *
 * THE CONTRACT: `whenIntroDone()` never rejects and never hangs. Every way
 * the gate can fail ends in `finishIntro()`, and when none of them fires a
 * timer in THIS module does it anyway. Consumers cannot forget the backstop
 * because they never arm it: `whenIntroDone()` answers the "is there even a
 * gate?" question itself, and the gate arms the sequence ceiling the moment
 * a tile is pressed.
 *
 * WHY A MODULE PROMISE and not the alternatives:
 *  - React context would need a provider above both <IntroGate /> and <main>
 *    in app/page.tsx, and a re-render to propagate. A state change to release
 *    an animation gate is strictly worse than a promise you can await inside
 *    the effect that is already awaiting fonts.
 *  - A DOM CustomEvent is LOSSY: React gives no contract about whether the
 *    hero's layout effect runs before or after the gate's, and a subscriber
 *    that arrives after the dispatch never hears it. You would need a sticky
 *    replay flag — i.e. you would rebuild this promise, with more parts.
 * A promise is the only shape that is inherently replay-safe: a late
 * subscriber gets the already-settled value for free.
 *
 * MODULE STATE, DELIBERATELY:
 *
 * - SSR. `typeof window === "undefined"` ⇒ the promise is born resolved and
 *   `settled` starts true, so an accidental server-side await returns at
 *   once instead of hanging a render. Nothing here is per-request — on the
 *   server every export is a no-op — so the single module instance a Node
 *   process keeps alive cannot leak state between visitors.
 *
 * - React 19 StrictMode (on by default in the App Router; next.config.ts
 *   does not opt out). Dev double-mounts every component: effect, cleanup,
 *   effect. `claimIntro()`, `finishIntro()` and `armIntroDeadline()` are all
 *   idempotent. The one asymmetry is the cleanup, and it is the whole trick:
 *   unmounting AFTER the sequence started must resolve (nobody is left to do
 *   it), unmounting BEFORE must not (the gate is coming straight back, and
 *   resolving would animate the hero behind an overlay about to reappear).
 *   The gate calls `releaseIntroClaim()` in that case, which hands the claim
 *   back and re-arms the grace for whoever is waiting.
 *
 * - A SECOND MOUNT. The promise is module scope: once resolved it stays
 *   resolved for the life of the page. A remounted Hero therefore reveals
 *   immediately (correct — the intro really is over) and a remounted gate
 *   asks `introSettled()` and skips straight to `display: none` rather than
 *   replaying an intro the visitor already sat through.
 *
 * - FAST REFRESH. Editing this file re-evaluates it, minting a fresh
 *   unresolved promise while live components hold the old one. That cannot
 *   bite: a module with no React component exports is not a refresh
 *   boundary, so Next falls back to a full page reload and every holder is
 *   replaced together. Editing intro-gate.tsx or hero.tsx alone remounts
 *   that component against this still-resolved promise — the "second mount"
 *   case above.
 */

/** Marks the gate's root element. Present in the SERVER-rendered HTML, so a
 *  consumer can tell whether an intro exists at all without depending on
 *  React's effect ordering. Written literally in intro-gate.tsx's JSX —
 *  keep the two in sync. */
export const INTRO_GATE_ATTR = "data-intro-gate";

/** How long a consumer waits for a gate that IS in the DOM to announce
 *  itself before deciding it is broken. Gate and hero mount in the same
 *  React commit and the gate's layout effect runs first (tree order), so
 *  this only ever expires if <IntroGate />'s effect never ran at all. The
 *  "there is no gate" case does not wait — see whenIntroDone(). */
const CLAIM_GRACE_MS = 1200;

/** Hard ceiling on the whole pick → cut sequence, armed by the gate the
 *  moment a tile is pressed. The honest worst case is ~5.6s (1.28s of tile
 *  shut, 1.2s of buffer grace, a 2.2s video ceiling, a 0.9s decode hold),
 *  so 7s means "something is broken — show the hero". */
const SEQUENCE_DEADLINE_MS = 7000;

/** The IDLE backstop: nobody ever pressed a tile. Without it the hero stays
 *  parked at opacity:0 for the whole page-view, so the page's only <h1>, its
 *  logo and its CTA are missing from the rendered-DOM snapshot a crawler
 *  indexes and from the accessibility tree — and Lighthouse never sees the
 *  hero at all.
 *
 *  It is CANCELLED by armIntroDeadline(), i.e. by the pick, and that is the
 *  whole point: from the moment a tile is pressed, SEQUENCE_DEADLINE_MS is a
 *  strictly better guarantee, so this timer must not also be racing. A
 *  visitor who reads the two options for a minute and then chooses still gets
 *  the full hero reveal after the stinger; only a visitor (or a bot) who
 *  never interacts at all trips this, and for them the gate is still opaque,
 *  so the reveal it releases happens out of sight and costs nothing. */
const IDLE_BACKSTOP_MS = 20000;

const isBrowser = typeof window !== "undefined";

/** Resolved at birth on the server: nothing animates during SSR, and an
 *  accidental await there must not hang a render. */
let settled = !isBrowser;
/** The gate may leave. STRICTLY narrower than `settled`: the idle backstop
 *  releases the hero without ever dismissing the gate — see finishIntro. */
let dismissed = !isBrowser;
let claimed = false;
let awaited = false;
let claimTimer: number | undefined;
let deadlineTimer: number | undefined;
let idleTimer: number | undefined;
let release: () => void = () => {};
let releaseGate: () => void = () => {};

const done: Promise<void> = isBrowser
  ? new Promise<void>((resolve) => {
      release = resolve;
    })
  : Promise.resolve();

/** The gate's own exit signal. Kept separate from `done` on purpose — see
 *  whenIntroDismissed(). */
const gateDone: Promise<void> = isBrowser
  ? new Promise<void>((resolve) => {
      releaseGate = resolve;
    })
  : Promise.resolve();

function clearTimer(id: number | undefined) {
  if (id !== undefined) window.clearTimeout(id);
}

/** Is a gate rendered on this page at all? The marker is in the server HTML,
 *  so this is answerable before any effect has run. */
function gateInDom(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector(`[${INTRO_GATE_ATTR}]`) !== null
  );
}

function armClaimGrace(): void {
  if (!isBrowser || settled || claimed || claimTimer !== undefined) return;
  claimTimer = window.setTimeout(() => {
    claimTimer = undefined;
    if (!claimed) finishIntro();
  }, CLAIM_GRACE_MS);
}

/**
 * Await this before revealing anything the intro is covering. Resolves
 * exactly once; never rejects, never hangs.
 *
 * Calling it is also what answers "is there an intro?", so a consumer gets
 * the backstop simply by asking the question:
 *   · no gate element in the DOM  → settle NOW (nothing to wait for; this is
 *     what keeps <Hero /> from sitting blank if someone removes <IntroGate />
 *     from app/page.tsx);
 *   · gate present but not yet claimed → wait, behind CLAIM_GRACE_MS;
 *   · gate claimed → wait for it, behind the gate's own sequence deadline.
 */
export function whenIntroDone(): Promise<void> {
  awaited = true;
  if (!settled && !claimed && !gateInDom()) {
    finishIntro();
    return done;
  }
  armClaimGrace();
  armIdleBackstop();
  return done;
}

/** Arms once. Cancelled by the pick (armIntroDeadline) — see IDLE_BACKSTOP_MS.
 *
 *  Releases the HERO ONLY. It must never dismiss the gate: doing so made the
 *  gate vanish on its own after a few seconds in front of a visitor who was
 *  simply still reading the two options, so their click landed on nothing.
 *  Un-parking the hero behind a still-opaque gate is invisible and costs
 *  nothing; removing the gate is the entire interaction. */
function armIdleBackstop(): void {
  if (!isBrowser || settled || idleTimer !== undefined) return;
  idleTimer = window.setTimeout(releaseHeroOnly, IDLE_BACKSTOP_MS);
}

/** The hero may un-park. Does NOT let the gate leave. */
function releaseHeroOnly(): void {
  if (settled) return;
  settled = true;
  clearTimer(idleTimer);
  idleTimer = undefined;
  release();
}

/** "There IS a gate, and it intends to run." Idempotent — React 19
 *  StrictMode calls it twice in dev. */
export function claimIntro(): void {
  if (!isBrowser || settled) return;
  claimed = true;
  clearTimer(claimTimer);
  claimTimer = undefined;
}

/** Hand the claim back when a gate unmounts BEFORE its sequence started —
 *  a StrictMode double-mount, or a Fast Refresh. The grace is re-armed for
 *  anyone already waiting, so a gate that never comes back still frees
 *  them, while a gate that remounts re-claims well inside the window. */
export function releaseIntroClaim(): void {
  if (!isBrowser || settled || !claimed) return;
  claimed = false;
  if (awaited) armClaimGrace();
}

/** The ceiling on a LIVE sequence. Arms once; later calls are no-ops. */
export function armIntroDeadline(ms: number = SEQUENCE_DEADLINE_MS): void {
  if (!isBrowser || settled || deadlineTimer !== undefined) return;
  // A sequence is running, so "is there a gate?" is answered for good.
  clearTimer(claimTimer);
  claimTimer = undefined;
  // …and so is "will anyone interact?". The idle backstop exists only for the
  // no-interaction case; leaving it armed would cut a slow-but-real visitor's
  // intro short and rob them of the hero reveal the stinger hands off to.
  clearTimer(idleTimer);
  idleTimer = undefined;
  deadlineTimer = window.setTimeout(finishIntro, ms);
}

/** The intro is over — for any reason at all, success or failure.
 *  Idempotent, and safe to call from an already torn-down component. */
export function finishIntro(): void {
  releaseHeroOnly(); // idempotent; may already have run via the idle backstop
  if (dismissed) return;
  dismissed = true;
  clearTimer(claimTimer);
  claimTimer = undefined;
  clearTimer(deadlineTimer);
  deadlineTimer = undefined;
  releaseGate();
}

/**
 * The gate's exit. Await this to remove the overlay.
 *
 * Deliberately NOT the same promise as whenIntroDone(). The hero un-parking
 * and the gate leaving are different events: the idle backstop does the first
 * (so a crawler is never shown a page whose only <h1> is visibility:hidden)
 * and must never do the second (so the overlay cannot evaporate in front of
 * someone who is still choosing). Only a real end — the clip finishing, a
 * genuine failure path, Escape, the post-pick deadline, or an unmount
 * mid-sequence — resolves this one.
 */
export function whenIntroDismissed(): Promise<void> {
  return gateDone;
}

/** Which tile the visitor pressed, if they pressed one. */
export type IntroChoice = "idea" | "product";
let choice: IntroChoice | null = null;

/** Recorded by the gate on the pick. The Evan story reads it to decide which
 *  script to tell, which is what the gate's question was FOR — it used to
 *  carry its own toggle asking the identical question with identical labels.
 *  Null when nobody chose (idle backstop, reduced motion, no gate). */
export function setIntroChoice(c: IntroChoice): void {
  choice = c;
}

export function getIntroChoice(): IntroChoice | null {
  return choice;
}

/** Has the intro already run this page-view? Lets a remounted gate skip the
 *  replay instead of re-covering a page the visitor has already seen. */
export function introSettled(): boolean {
  // `dismissed`, not `settled`: a remounted gate must only skip the intro if
  // the intro actually ENDED. The idle backstop sets `settled` while the gate
  // is still legitimately on screen waiting for a choice.
  return dismissed;
}
