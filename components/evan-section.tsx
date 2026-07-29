"use client";

import type { ReactNode } from "react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { beacon } from "@/lib/beacon";
import { getIntroChoice, whenIntroDismissed, whenIntroDone } from "@/lib/intro";
import type { WordSplit } from "@/lib/motion";
import {
  EASE,
  easeFn,
  hasLiveHold,
  onceInView,
  park,
  playFrom,
  playTo,
  splitWords,
} from "@/lib/motion";
import { siteConfig } from "@/lib/site-config";
import styles from "./evan-section.module.css";

// ─────────────────────────────────────────────────────────────────────────
// Evan scroll story — a faithful port of the "Proovd Scroll Storyyy"
// reference design. Scrolling is 100% native: a passive scroll listener derives
// per-step assembly/leave targets plus a continuous story position g, and a
// rAF loop chases those targets with exponential smoothing (k = 1−e^(−dt·7)).
// The choreography (custom rAF + CSS transitions + the THREE.js corner-peel)
// IS the design — keep this section's self-contained engine as-is and don't
// copy its scroll-chasing patterns into the other sections.
// ─────────────────────────────────────────────────────────────────────────

type Mode = "idea" | "product";

type EvanStep = {
  img: string;
  alt: string;
  title: string;
  body: ReactNode;
};

const SMILING = "/assets/Evan_main_smiling.webp";

// ── the story, told once. ONE copy set per mode, identical on both postures
// (owner: "make it the same copy in the phone") — only the photo files differ
// by posture (the laptop cuts vs the phone stamps of the same four subjects).
// Plain strings, no <mark>: the phone's word-masked reveal needs raw words,
// and desktop follows the same copy. There is no "Evan…" kicker anywhere —
// the opening "This is Evan…" statement introduces him, so the headline
// carries the subject itself.
type StepCopy = {
  alt: string;
  title: string;
  body: string;
};

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

// App variant: the same four beats and cadence for someone who ALREADY has a
// product and needs marketing — "idea" becomes "app" and the framing shifts
// from validation to demand.
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

// the same four subjects, cut per posture (the owner re-exported the whole
// set as webp — `*_desktop` replaces `*_laptop`, `*_mobile` the bare names)
const LAPTOP_PHOTOS = [
  "/assets/Evan_idea_desktop.webp",
  "/assets/even_saying_idea_desktop.webp",
  "/assets/campaign_evan_desktop.webp",
  "/assets/Money_Evan_desktop.webp",
];
const PHONE_PHOTOS = [
  "/assets/Evan_idea_mobile.webp",
  "/assets/even_saying_idea_mobile.webp",
  "/assets/campaign_evan_mobile.webp",
  "/assets/money_evan_mobile.webp",
];

// PRODUCT swaps only the FIRST subject (owner: "when i select product the
// first pic should be the evan product pic … same for phone the phone
// version"): Evan with the product in hand instead of having the idea. The
// other three subjects are shared. E3 loads the UNION of both sets before it
// builds the renderer, so the flip lands on a ready texture / warm cache on
// every path.
const LAPTOP_PHOTOS_PRODUCT = [
  "/assets/Product_evan_desktop.webp",
  ...LAPTOP_PHOTOS.slice(1),
];
const PHONE_PHOTOS_PRODUCT = [
  "/assets/Product_evan_mobile.webp",
  ...PHONE_PHOTOS.slice(1),
];

const tellWith = (copy: StepCopy[], photos: string[]): EvanStep[] =>
  copy.map((c, i) => ({ img: photos[i], ...c }));

// Desktop (≥701px): the laptop photos on the navbar's #011E0B surface,
// whichever path was picked (the palette is pinned in the stylesheet).
const IDEA_STEPS = tellWith(IDEA_COPY, LAPTOP_PHOTOS);
const PRODUCT_STEPS = tellWith(PRODUCT_COPY, LAPTOP_PHOTOS_PRODUCT);

// Phone (≤700px): the same story on the phone stamps — plus the finale
// extras (pledge stack + CTA) that only exist in the phone JSX. The posture
// is fixed per mounted instance (see EvanSection), so the engine's step
// count never changes under it.
const IDEA_STEPS_M = tellWith(IDEA_COPY, PHONE_PHOTOS);
const PRODUCT_STEPS_M = tellWith(PRODUCT_COPY, PHONE_PHOTOS_PRODUCT);

// ── shared math + painters (pure — no window access at module scope) ─────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeBack = (x: number) => {
  const c = 1.8;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

type StepRec = {
  el: HTMLElement;
  // What the engine MEASURES for this step's progress. Normally the step box
  // itself, but the phone finale step is a tall runway (title + pledge + CTA +
  // padding), and its geometric centre sits deep in that runway — measuring it
  // meant the title only assembled once you had scrolled far past it, i.e. the
  // last step's text never appeared. Anchoring on the title fixes that.
  anchor: HTMLElement;
  title: HTMLElement | null; // the h3 — phone hides it outright when off-beat
  body: HTMLElement | null;
  extras: HTMLElement[]; // phone-only late arrivals (pledge sticker, CTA)
  phone: boolean; // posture — drives the simpler, reliable phone text motion
  words: HTMLElement[];
  bodyWords: HTMLElement[]; // phone: the body is word-masked like the headline
  lines: number[]; // visual line index per word — lines rise as one unit
  // Phone: SIGNED distance from the reading line, in units of half the beat
  // on the side the step is on. -ve = above the line (leaving), +ve = below
  // (arriving). paintStep derives BOTH the direction and the strength from
  // this one value, so neither can jump — deriving the direction from a
  // separately-smoothed magnitude let the sign flip while a word was still
  // part-way out of its mask (the "mask glitches" bug).
  //
  // sS is written DIRECTLY by E1's textLoop from one smoothed scroll position
  // (pS), not chased per step: per-step chases are only equivalent to that
  // while unclamped, and the clamp let a fast fling show two headlines at
  // once. Do NOT reintroduce a per-step smoother here. sT is dead state kept
  // only so the record shape is stable; nothing writes or reads it now.
  sT: number; // (unused — see above)
  sS: number; // phone: signed distance, written from pS each frame
  target: number; // assembly progress the step is chasing (0..1)
  lvT: number; // leave progress target
  sp: number; // smoothed assembly
  lv: number; // smoothed leave
  done: boolean;
};

// group headline words into visual lines so each line rises as one composed
// unit (the word's mask span is the measured element)
function measureLines(r: StepRec) {
  if (!r.words.length) return;
  const tops: number[] = [];
  r.lines = r.words.map((w) => {
    const t = w.parentElement ? (w.parentElement as HTMLElement).offsetTop : 0;
    let li = tops.findIndex((v) => Math.abs(v - t) < 8);
    if (li === -1) {
      tops.push(t);
      li = tops.length - 1;
    }
    return li;
  });
}

// text chases scroll with inertia; choreography assembles early and exits
// like a conveyor. Writes inline styles only — none of these nodes ever
// gets a React `style` prop, so React never fights the loop.
function paintStep(r: StepRec) {
  // assembly finishes by 3/4 of the approach — parked text is always whole
  const a = clamp01(r.sp / 0.75);
  const lv = r.lv;

  // ── PHONE motion (r.phone). Deliberately simpler + more reliable than the
  // desktop word-swing: a clean vertical MASK reveal (no rotate, no overshoot)
  // and a full fade-OUT to opacity 0 as the step scrolls off — so old text is
  // genuinely gone, not ghosting at the top. Desktop (below) is untouched.
  if (r.phone) {
    // ONE smoothed signed value drives everything. |s| is the exclusive
    // visibility ramp (1 at the reading line, 0 by the midpoint to the
    // neighbouring beat); its SIGN is the travel direction, so words rise IN
    // from below while arriving and lift OUT through the top of their mask
    // while leaving. Because the sign comes from the same smoothed number, it
    // can only flip as s passes through 0 — where the words are fully home and
    // the offset is 0 — so there is no jump across the visible area.
    const s = r.sS;
    const dir = s >= 0 ? 1 : -1;
    const LO = 0.45; // hold full strength inside 45% of the half-gap
    const v = 1 - clamp01((Math.abs(s) - LO) / (1 - LO));
    // HIDE distance. `.w` adds 0.22em of padding above and below the word, and
    // overflow:hidden clips to that padding box — so clearing the mask needs
    // (lineHeight + 0.22em) / lineHeight of travel: 121.6% for the headline
    // (line-height 1.02) and 113.8% for the body (1.6). The old 120% was SHORT
    // of the headline's requirement, which left a permanent ~2% sliver of every
    // departing word on screen — "I keep seeing the text from above it". 140%
    // clears both with margin at any line-height these ever take.
    const OUT = 140;
    // …and an opacity dead-zone, so a word is hard-off before it is anywhere
    // near its mask edge rather than fading through a faint residue.
    const fade = (e: number) => clamp01((e - 0.06) / 0.34);
    r.words.forEach((w, i) => {
      // quart-out: decisive, soft landing, zero overshoot (no wobble)
      const e = easeFn.out3(
        clamp01((v - 0.05 - (r.lines[i] || 0) * 0.1) / 0.55),
      );
      w.style.transform = `translateY(${(dir * (1 - e) * OUT).toFixed(2)}%)`;
      w.style.opacity = fade(e).toFixed(3);
    });
    // the body reveals word by word through its own masks, exactly like the
    // headline, just starting later and running tighter so it reads as one
    // sentence arriving rather than a second headline
    r.bodyWords.forEach((w, i) => {
      const e = easeFn.out3(clamp01((v - 0.22 - i * 0.008) / 0.55));
      w.style.transform = `translateY(${(dir * (1 - e) * OUT).toFixed(2)}%)`;
      w.style.opacity = fade(e).toFixed(3);
    });
    // Final backstop: when a step has no visibility at all, take its text out
    // of rendering entirely. Guarantees nothing can linger regardless of the
    // per-word maths, and costs one property write on a state change.
    const off = v <= 0.002 ? "hidden" : "";
    if (r.title && r.title.style.visibility !== off) {
      r.title.style.visibility = off;
    }
    if (r.body && r.body.style.visibility !== off) {
      r.body.style.visibility = off;
    }
    if (r.body) {
      // the container stays clean — its words carry the motion
      r.body.style.transform = "";
      r.body.style.opacity = "";
    }
    // NOTE: --mk is gone everywhere now (the shared copy has no <mark> and
    // the stylesheet rule was removed). It must not come back as a per-frame
    // write here regardless: writing an inherited custom property
    // invalidates the element's whole subtree every frame — on the finale
    // that subtree is the pledge cards + the CTA.
    //
    // The step CONTAINER is never faded on phone: the finale has to keep its
    // pledge + CTA visible long after its own title has gone, and every other
    // step is already fully hidden by its words' masks + opacity.
    r.el.style.transform = "";
    r.el.style.opacity = "";
    return;
  }

  // ── DESKTOP motion (unchanged): lines swing up and lean into place
  r.words.forEach((w, i) => {
    const e = easeBack(clamp01((a - 0.06 - (r.lines[i] || 0) * 0.16) / 0.5));
    w.style.transform = `translateY(${((1 - e) * 130).toFixed(2)}%) rotate(${((1 - e) * -7).toFixed(2)}deg)`;
  });
  // body: trails in, whisper-quiet
  if (r.body) {
    const e = easeOut(clamp01((a - 0.42) / 0.38));
    r.body.style.transform = `translateY(${((1 - e) * 26).toFixed(2)}px)`;
    r.body.style.opacity = e.toFixed(3);
  }
  // The finale extras (pledge stack + CTA) are NOT painted here — they
  // reveal on their own as each scrolls into view (onceInView in E1), so they
  // behave like content you scroll TO and snap onto rather than a value tied
  // to this step's leave progress. A step with extras is the finale.
  const finale = r.extras.length > 0;
  // (no --mk write any more: the shared copy is plain strings with no <mark>,
  // so the old highlight sweep has nothing to paint)
  if (finale) {
    // the finale step never "leaves" — it's the last thing, and its lower half
    // is the runway the pledge + CTA occupy, so it holds put and stays lit
    // instead of riding up and dimming.
    r.el.style.transform = "";
    r.el.style.opacity = "";
  } else {
    // exit: the whole step rides up and dims as the next one takes over
    r.el.style.transform = `translateY(${(-30 * easeOut(lv)).toFixed(2)}px)`;
    r.el.style.opacity = (1 - 0.6 * easeOut(lv)).toFixed(3);
  }
}

// ── corner-peel shaders (ported from the Corner Peel export) ─────────────

const VERT = `
  uniform vec2  uCorner;
  uniform vec2  uDir;
  uniform float uCrease;
  uniform float uRadius;
  varying vec3  vN;
  varying vec2  vUv;
  varying float vT;
  varying float vCrease;
  varying float vTheta;
  void main(){
    vUv = uv;
    vec3 pos = position;
    float t = dot(pos.xy - uCorner, uDir);
    vec2 perp = pos.xy - uCorner - t*uDir;
    vCrease = uCrease; vT = t;
    if(t >= uCrease){
      vN = vec3(0.0,0.0,1.0);
      vTheta = 0.0;
      gl_Position = projectionMatrix*modelViewMatrix*vec4(pos,1.0);
    } else {
      float a = uCrease - t;
      float theta = a/uRadius;
      theta = min(theta, 7.0);
      float along = uCrease - uRadius*sin(theta);
      float h     = uRadius*(1.0 - cos(theta));
      vec2 xy = uCorner + along*uDir + perp;
      vec3 n  = normalize(vec3(sin(theta)*uDir, cos(theta)));
      vN = n; vTheta = theta;
      gl_Position = projectionMatrix*modelViewMatrix*vec4(xy, h, 1.0);
    }
  }`;

const FRAG = `
  precision highp float;
  uniform sampler2D uMap;
  uniform sampler2D uStamp;
  uniform vec2  uRepeat;
  uniform vec2  uOffset;
  uniform float uBackOpacity;
  uniform float uFrost;
  uniform float uShading;
  uniform float uShadingSoft;
  uniform float uSheen;
  uniform float uShadow;
  uniform float uShadowSoft;
  uniform float uFade;
  uniform vec3  uLight;
  varying vec3  vN;
  varying vec2  vUv;
  varying float vT;
  varying float vCrease;
  varying float vTheta;
  const float PI = 3.14159265;
  void main(){
    vec4 tex = texture2D(uMap, vUv * uRepeat + uOffset);
    float stampA = texture2D(uStamp, vUv).a;
    if(tex.a * stampA < 0.004) discard;
    bool front = vN.z >= 0.0;
    vec3 V = vec3(0.0,0.0,1.0);
    vec3 N = front ? vN : -vN;
    vec3 L = normalize(uLight);
    float curl = clamp(vTheta, 0.0, 7.0);
    vec3 base; float alpha;
    if(front){
      base  = tex.rgb;
      alpha = tex.a;
    } else {
      vec3 plastic = tex.rgb;
      float lum = dot(plastic, vec3(0.299,0.587,0.114));
      plastic = mix(plastic, vec3(lum), 0.12);
      plastic = mix(plastic, vec3(1.0), clamp(uFrost,0.0,1.0)*0.6);
      base  = plastic;
      alpha = tex.a * clamp(uBackOpacity,0.0,1.0);
    }
    float diff = clamp(dot(N,L), 0.0, 1.0);
    float lit  = 0.64 + 0.36*diff;
    vec3 col = base * mix(1.0, lit, uShading);
    float aoSoft = mix(0.6, 3.0, clamp(uShadingSoft/50.0, 0.0, 1.0));
    float ao = smoothstep(0.0, aoSoft, curl) * (1.0 - 0.45*diff);
    col *= 1.0 - 0.45*uShading*ao;
    vec3 H = normalize(L+V);
    float spec = pow(max(dot(N,H),0.0), 46.0);
    float crest = sin(clamp(vTheta, 0.0, PI));
    float sheenBoost = front ? 1.0 : 1.7;
    col += uSheen * spec * (0.35 + 0.65*crest) * sheenBoost;
    if(!front){
      float fres = pow(1.0 - max(dot(N,V),0.0), 3.0);
      col   += fres * 0.20 * (0.5 + uSheen);
      alpha  = clamp(alpha + fres*0.10, 0.0, 1.0);
    }
    float d  = vT - vCrease;
    float wv = mix(0.012, 0.10, clamp(uShadowSoft/50.0, 0.0, 1.0));
    float wd = mix(0.03,  0.34, clamp(uShadowSoft/50.0, 0.0, 1.0));
    float fold = exp(-abs(d)/wv);
    float drop = smoothstep(wd, 0.0, max(d, 0.0));
    float shade = uShadow * clamp(max(fold*0.85, drop*0.8), 0.0, 1.0);
    col *= 1.0 - 0.6*shade;
    gl_FragColor = vec4(col, alpha*uFade*stampA);
  }`;

type PeelApi = {
  active: boolean;
  setProgress: (g: number) => void;
  setMode: (m: Mode) => void;
  /** intro handoff: the first sheet rolls back down flat — peel, reversed */
  entrance: () => void;
};

function EvanStory({ posture }: { posture: "desktop" | "phone" }) {
  const isPhone = posture === "phone";
  const [mode, setMode] = useState<Mode>("idea");
  const [live, setLive] = useState(false); // JS engine running (port of html.js)
  const rootRef = useRef<HTMLElement>(null);
  const peelMountRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>(mode);
  const gRef = useRef(0); // continuous story position, 0..4
  const peelRef = useRef<PeelApi | null>(null);
  const introBusyRef = useRef(false); // statement playing — magnet stands down
  const introBoostRef = useRef(false); // just handed off — step 1 assembles
  // Holds step one disassembled AFTER the cut. Split out of introBusyRef,
  // which conflated "statement playing / scroll locked / magnet stands down"
  // with "keep step one hidden": scroll is freed at the cut but the text
  // doesn't enter until its own cue, so a swipe in that window would scroll
  // past a headline pinned at opacity 0. Every failure path clears it.
  const introParkRef = useRef(false);
  // Intro: keep the progress bar dark AND its fill pinned empty until its own
  // cue, so the first bar visibly FILLS as part of the sequence instead of
  // already being full by the time the bar fades in. Both postures — the bar
  // is the same fixed bottom treatment everywhere now.
  const barsHeldRef = useRef(false);
  // The intro parks the media panel hidden until the peel's first rolled-off
  // frame. E1's closing-screen retire writes the SAME element's opacity every
  // frame, so it has to stand down while this is set or it un-parks it
  // instantly and the flat sheet flashes again.
  const mediaParkedRef = useRef(false);
  const stepsRef = useRef<StepRec[]>([]);
  const updateRef = useRef<() => void>(() => {});
  const layoutRef = useRef<() => void>(() => {});

  // E1 — the story engine: scroll → targets, rAF chase loop, whisper magnet,
  // and the layout sync (media aspect + sticky offsets from the real navbar).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const stepEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-step]"),
    );
    const scenes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-scene]"),
    );
    const ticks = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-tick]"),
    );
    const rollEl = root.querySelector<HTMLElement>("[data-ev-roll]");
    const mgEl = root.querySelector<HTMLElement>("[data-ev-mg]");
    const mediaEl = root.querySelector<HTMLElement>("[data-ev-media]");
    const capEl = root.querySelector<HTMLElement>("[data-ev-cap]");
    if (!stepEls.length || !rollEl || !mgEl || !mediaEl) return;

    const recs: StepRec[] = stepEls.map((el) => {
      const title = el.querySelector<HTMLElement>("h3");
      const extras = Array.from(
        el.querySelectorAll<HTMLElement>("[data-ev-extra]"),
      );
      return {
        el,
        // Phone: EVERY step measures from its TITLE, not its box. Centring
        // the box put the title higher on steps with more body text (title +
        // body centred together), so the text landed at a different height
        // on every beat. Desktop keeps box centres — EXCEPT the finale,
        // whose box now includes the pledge/CTA runway: its geometric centre
        // sits deep in that runway, so it too anchors on the title (the same
        // fix the phone finale needed from the start).
        anchor: isPhone || extras.length ? (title ?? el) : el,
        title,
        body: el.querySelector<HTMLElement>("[data-ev-body]"),
        extras,
        phone: isPhone,
        words: [],
        bodyWords: [],
        lines: [],
        sT: 3,
        sS: 3,
        target: 0,
        lvT: 0,
        sp: 0,
        lv: 0,
        done: false,
      };
    });
    stepsRef.current = recs;
    setLive(true);

    // Finale (both postures): the pledge stack + CTA reveal as they scroll
    // into view (not driven by the story chase), so they behave like content
    // you scroll TO and that then HOLDS — combined with being magnet snap
    // targets (see nudge), a gesture lands on them instead of blowing past.
    // Setting data-in triggers the pledge cards' CSS bounce and the CTA's
    // reveal transition.
    const finaleRec = recs[recs.length - 1];
    const finaleReveals: Array<() => void> = [];
    if (finaleRec?.extras.length) {
      const exs = finaleRec.extras;
      finaleReveals.push(
        // ONE trigger for the whole closing screen: the pledge stack + CTA
        // are the same beat now, so they reveal together off the stack's
        // arrival (the CTA follows on a CSS transition-delay). 68, not 95: at
        // 95 it revealed the instant it touched the bottom edge — while the
        // finale headline was still ~halfway up and legible — so the pledge
        // appeared alongside the text instead of after it. 68 waits until
        // the headline is past its own midpoint (already gone). DESKTOP goes
        // deeper still (52 ≈ the reading line the magnet centres the stack
        // on): its 55vh runway is crossed by one fast advance glide, and at
        // 68 the cards' 0.56s pop ran mid-flight and was over by landing —
        // read as "the stack animation is gone". At 52 they pop at rest.
        onceInView(exs[0], isPhone ? 68 : 52, () => {
          for (const ex of exs) ex.setAttribute("data-in", "1");
        }),
      );
    }

    const mqM = window.matchMedia("(max-width: 900px)");
    // the repo navbar is FIXED and overlays content — measure the real thing
    const navEl = document.querySelector<HTMLElement>('nav[aria-label="Main"]');
    // Phone reading line comes from the sticky media's RESTING geometry (the
    // top layout() writes + its height), refreshed only in layout().
    let mediaBottom = 0;

    // ── PHONE text model: ONE scroll scalar, smoothed ONCE ────────────────
    // pT is the reading line's position along the story, in px, measured from
    // step 0's anchor: pT = READ − centres[0]. Every step's signed distance is
    // then (relStep[i] − pT) — pure layout minus one scroll number. relStep /
    // halfUp / halfDown are DIFFERENCES of centres, so they are
    // scroll-independent (the page moves as one) and change only on a real
    // layout change. update() refreshes them; textLoop smooths pT and derives
    // every step from the result, which is what makes exclusivity a per-frame
    // property instead of a property of the targets alone (see textLoop).
    const relStep: number[] = recs.map(() => 0);
    const halfUp: number[] = recs.map(() => 1);
    const halfDown: number[] = recs.map(() => 1);
    let pT = 0;
    let pS = Number.NaN; // smoothed pT; NaN = adopt the first sample
    let lagCap = 240; // px the text may ever owe the scroll (see textLoop)
    const firstImage = () =>
      root.querySelector<HTMLImageElement>("[data-ev-scene] img");

    const readLineY = () => {
      const H = window.innerHeight;
      if (mqM.matches && mgEl) {
        // reading line sits below the stamp — far enough that the text isn't
        // crowding the photo (owner: "too close to the pics, move it down"),
        // but not so far it floats a third of a screen away.
        // On phone it comes from the sticky group's RESTING geometry, cached
        // in layout(): .mediaGroup is position:sticky, so over the finale
        // runway it un-sticks and its live rect.bottom collapses to the 56px
        // floor — which yanked READ (and with it the assembly window, the
        // engaged() test and the magnet's destination) mid-scroll. It also
        // removes two forced layouts per frame.
        const mb =
          isPhone && mediaBottom
            ? mediaBottom
            : Math.max(56, mgEl.getBoundingClientRect().bottom);
        // On phone this is where a step's title TOP goes (see anchorY), not a
        // centre.
        //
        // This offset is the title's CLEARANCE under the stamp, and it must
        // not be shrunk: `.mediaGroup` is sticky, opaque and z-index 5, so as
        // you scroll on, the title rises and slides UNDER it. The title stays
        // fully opaque for 0.45 × a half-beat (~93px) of that rise, so a gap
        // much smaller than that puts solid text under the stamp and reads as
        // the word masks clipping. Tried 22 (to copy step one's old un-stuck
        // look) — that is exactly what it broke.
        return mb + Math.min(95, (H - mb) * 0.23);
      }
      return H * 0.5;
    };

    // Where an anchor is considered to "be", relative to the reading line.
    //
    // PHONE measures its TOP; desktop keeps the box CENTRE. Centring is what
    // made the text sit at different heights per step: a title's centre lands
    // on the line, so a TWO-line title starts half a line HIGHER than a
    // one-line one (measured: 469 vs 491). Aligning tops puts every step's
    // copy at exactly the same y no matter how the headline wraps. Used by
    // BOTH update() and the magnet, so the snapped resting position is by
    // construction the position the engine assembles at.
    const anchorY = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return isPhone ? r.top : r.top + r.height / 2;
    };

    // the panel follows the photos' native ratio; the sticky offsets follow
    // the measured nav so the media clears the fixed bar on both layouts
    const layout = () => {
      const mob = mqM.matches;
      const img = firstImage();
      const iw = img?.naturalWidth ?? 0;
      const ih = img?.naturalHeight ?? 0;
      // The panel takes the photo's OWN aspect. Until the image has actually
      // reported its dimensions we write NOTHING and let the stylesheet's
      // aspect-ratio stand: the old `|| 717 / 533` fallback is the DESKTOP
      // photo's shape, and on phone it stuck at 1.345 (the phone stamps are
      // 380x210 = 1.81), which is why they rendered square and cover-cropped.
      // onImgLoad below re-runs this the moment the real dimensions land.
      if (iw > 0 && ih > 0) {
        const boxR = iw / ih;
        mediaEl.style.aspectRatio = String(boxR);
        mediaEl.style.width = mob
          ? `min(100%, calc(52vh * ${boxR.toFixed(4)}))`
          : `min(100%, calc(70vh * ${boxR.toFixed(4)}))`;
      }
      const navH = navEl?.offsetHeight ?? 0;
      mgEl.style.top = mob
        ? // Upper-middle, clear of the navbar. Consistency across steps is NOT
          // achieved by moving this down to where step one's stamp used to
          // sit un-stuck — that shrinks the title's clearance under the stamp
          // and pushes solid text underneath it. It is achieved by making step
          // one STUCK like the others (see `.step:first-child`'s padding-top).
          `${Math.max(navH + 8, Math.round(window.innerHeight * 0.2))}px`
        : `${Math.max(navH + 12, (window.innerHeight - mgEl.offsetHeight) / 2)}px`;
      // (the progress bar is pinned full-width to the viewport bottom by CSS
      // on every posture — its geometry is entirely the stylesheet's)
      // resting bottom of the sticky group — the phone reading line's anchor
      mediaBottom = mob
        ? Number.parseFloat(mgEl.style.top || "0") + mgEl.offsetHeight
        : 0;
    };
    layoutRef.current = layout;

    const update = () => {
      const H = window.innerHeight;
      const centres = recs.map((r) => anchorY(r.anchor));

      const READ = readLineY();
      const mob = mqM.matches;
      const mb =
        mob && mgEl
          ? isPhone && mediaBottom
            ? mediaBottom // resting geometry — see readLineY
            : Math.max(56, mgEl.getBoundingClientRect().bottom)
          : 0;
      // Phone starts assembling LATER (0.95 vs 1.05). At 1.05 a step whose
      // centre sat right at the bottom edge was already part-assembled, so the
      // next headline was legible down at the very bottom of the screen —
      // right where the fixed progress bar is. Below 1.0 nothing assembles
      // until its centre is actually inside the viewport.
      const START = H * (isPhone ? 0.95 : mob ? 1.05 : 1.08);
      const END = mob ? READ + (H - mb) * 0.16 : H * 0.68;
      const zone = mob ? Math.max(120, (H - mb) * 0.55) : H * 0.42;
      recs.forEach((r, i) => {
        r.target = reduced ? 1 : clamp01((START - centres[i]) / (START - END));
        // leaving: how far past the reading line this step has travelled
        r.lvT = reduced ? 0 : clamp01((READ - centres[i]) / zone);
      });

      // ── PHONE: exactly ONE step's text may be legible at a time.
      //
      // The old fixed windows could not guarantee that: a step stayed legible
      // across ~422px of travel while the gaps between beats are only
      // 333/455/266px (the finale's anchor is its short title), so neighbours
      // overlapped by up to 156px — two headlines on screen at once.
      //
      // Visibility is the distance from the reading line normalised per side
      // by half that side's OWN beat, so exclusivity holds by construction at
      // any scroll offset and any screen size — not by tuning.
      if (!reduced && isPhone) {
        // Refresh the LAYOUT half of the model only. All the scroll lives in
        // the single scalar pT at the bottom of this block.
        const last = recs.length - 1;
        let minGap = Number.POSITIVE_INFINITY;
        for (let i = 0; i <= last; i++) {
          relStep[i] = centres[i] - centres[0];
          const up = i > 0 ? centres[i] - centres[i - 1] : 0;
          const down = i < last ? centres[i + 1] - centres[i] : 0;
          // Each SIDE is normalised by half its OWN beat, not by half the
          // shorter of the two. For any adjacent pair the two facing radii are
          // 0.9725 × (p/2) each and sum to 0.9725p < p, so their legible
          // intervals still cannot overlap — the same guarantee
          // min(prev, next) gave, and it holds for every pitch. What it drops
          // is the cross-talk: min() let the short 266px finale beat also
          // shrink step 2's approach across the 455px beat above it, leaving a
          // measured 164px of scroll (1329→1493 at 375×812) with NO text on
          // screen at all. Ends borrow their one real neighbour; a lone step
          // falls back to a screenful so its window stays finite.
          const gUp = up > 0 ? up : down > 0 ? down : H * 0.6;
          const gDown = down > 0 ? down : up > 0 ? up : H * 0.6;
          halfUp[i] = Math.max(1, gUp * 0.5);
          halfDown[i] = Math.max(1, gDown * 0.5);
          if (down > 0) minGap = Math.min(minGap, down);
          recs[i].lvT = 0; // the words carry the exit; no separate leave fade
        }
        if (!Number.isFinite(minGap)) minGap = H * 0.6;
        lagCap = Math.max(90, minGap * 0.55); // see textLoop
        pT = READ - centres[0];

        // ── retire the story chrome on the CLOSING screen ──────────────────
        // .mediaGroup is position:sticky inside .walk, so without this it
        // stays pinned at 20vh for the last ~350px of the section — floating
        // the stamp straight over the pledge/CTA and riding down with you into
        // the next section ("none of this should scroll down with me"). The
        // fixed progress bar has the same problem. Both fade out as the
        // closing screen arrives and fade back if you scroll up, because this
        // is derived per-frame rather than latched.
        const closer = mediaParkedRef.current ? null : recs[last]?.extras[0];
        if (closer) {
          const ct = closer.getBoundingClientRect().top;
          // 0 while the closing screen is still below the reading line, 1 once
          // it has clearly taken the screen
          const gone = clamp01((READ - ct) / 200);
          const vis = (1 - gone).toFixed(3);
          if (mgEl.style.opacity !== vis) mgEl.style.opacity = vis;
          // …and stop it swallowing taps once it is invisible. It is
          // opacity 0, not display:none, so it still hit-tests over its old
          // box (y 162–380 at 390x812) — and the closing screen's CTA rises
          // INTO that box as you scroll the new 36vh dwell, which would
          // leave the button visibly there but dead. Derived per-frame like
          // the opacity, so scrolling back up restores it.
          const dead = gone > 0.5 ? "none" : "";
          if (mgEl.style.pointerEvents !== dead)
            mgEl.style.pointerEvents = dead;
          if (capEl) capEl.dataset.closing = gone > 0.5 ? "1" : "";
        }
      }

      // intro handoff choreography: while the opening statement plays, step
      // one waits fully disassembled beneath the opaque overlay; the moment
      // the statement hands off it's floored to fully-assembled instead, so
      // the chase loop plays the text in. The floor retires on the first
      // real user input — natural scroll targets take over from there.
      if (!reduced && recs[0]) {
        if (introBusyRef.current || introParkRef.current) {
          recs[0].target = 0;
          recs[0].lvT = 0;
          // Phone: park the READING LINE three half-beats above step 0 rather
          // than forcing that one step's distance. Any position of the line is
          // a legal, self-consistent state of the whole story, so the parked
          // frames are covered by the same exclusivity proof; forcing a single
          // step would be the one input the single-scalar model cannot see.
          // Reproduces the old sT = 3 exactly: d0 = 3·halfUp[0] ⇒ s0 = 3.
          pT = -3 * halfUp[0];
        } else if (introBoostRef.current) {
          recs[0].target = 1;
          recs[0].lvT = 0;
          // Pin the line exactly on step 0's anchor: s0 = 0, so step one is
          // fully assembled BY CONSTRUCTION at every screen size, and
          // s1 = rel1/halfUp[1] = p0/(p0/2) = 2, so step two is guaranteed
          // hidden. The chase from the parked −3 to 0 is the same exponential
          // with the same k, so the handoff plays in at the same pace.
          pT = 0;
        }
      }

      // g: continuous position across the story, 0..4
      let g = 0;
      if (centres[0] <= READ) {
        g = recs.length - 1;
        for (let k = 0; k < recs.length - 1; k++) {
          if (READ < centres[k + 1]) {
            g = k + (READ - centres[k]) / (centres[k + 1] - centres[k]);
            break;
          }
        }
      }
      if (reduced) g = Math.round(g);

      // scenes: crossfade fallback (skipped entirely once the peel is live)
      if (!peelRef.current?.active) {
        // Hard cut, not a crossfade. The old ramp put BOTH neighbours at ~0.5
        // opacity mid-transition, so the mint stamp behind them showed through
        // and the picture appeared to blink. One scene is on, the rest are off.
        // (Only reached when the WebGL peel is unavailable — .peelOn hides
        // these entirely otherwise.)
        const active = Math.round(g);
        scenes.forEach((sc, i) => {
          const on = i === active ? "1" : "0";
          sc.style.setProperty("--v", on);
          sc.style.opacity = on;
        });
      }
      peelRef.current?.setProgress(g);
      gRef.current = g;

      // ── DESKTOP: retire the story chrome at BOTH boundaries. The sticky
      // stamp un-pins at the section's edges (it rides at its natural
      // position once the section top drops below its pin, and at the end of
      // its grid area), and the bar is fixed — so at either boundary they
      // would travel out of the story with the page ("when I scroll up from
      // the first one it moves up with this"). Fade them as the section
      // leaves and back if you return — derived per-frame, never latched,
      // exactly like the phone's closing-screen retire above. The statement
      // overlay covers the approach, so the fade is invisible on a normal
      // entry; it only ever shows at a real exit.
      // (stands down while the intro has the panel parked at opacity 0 —
      // this writes the SAME element's opacity every frame and would
      // otherwise un-park it instantly, flashing the flat first sheet)
      if (!reduced && !isPhone && !mediaParkedRef.current) {
        const rr = root.getBoundingClientRect();
        let gone = Math.max(
          clamp01(rr.top / 200), // leaving upward — the top edge descends
          clamp01((H * 0.9 - rr.bottom) / 200), // leaving downward
        );
        // …and on the closing screen (pledge + CTA), exactly like the phone:
        // the chrome must not float over the payoff
        const closer = recs[recs.length - 1]?.extras[0];
        if (closer) {
          const ct = closer.getBoundingClientRect().top;
          gone = Math.max(gone, clamp01((READ - ct) / 200));
        }
        const vis = (1 - gone).toFixed(3);
        if (mgEl.style.opacity !== vis) mgEl.style.opacity = vis;
        if (capEl) capEl.dataset.closing = gone > 0.5 ? "1" : "";
      }

      // the progress bar is position:fixed (bottom of the viewport) on every
      // posture, so gate its opacity on the story actually owning the screen —
      // otherwise it would float over the hero and every section below/above.
      // Test the viewport CENTRE, not readLineY: near the boundary readLineY
      // can sit below the fold (the sticky media is still off-screen), which
      // read the section as "engaged" the instant its top touched the bottom
      // edge.
      if (capEl) {
        const rr = root.getBoundingClientRect();
        const mid = window.innerHeight / 2;
        const owns = rr.top < mid && rr.bottom > mid;
        // …and it also retires on the closing screen (set just above), so the
        // bar doesn't ride the last screen down into the next section
        const held = barsHeldRef.current; // intro: stay dark until the cue
        capEl.style.opacity =
          owns && !held && capEl.dataset.closing !== "1" ? "1" : "0";
      }

      if (reduced) {
        // static progress paint (the chase loop is off; the numeric counter
        // is display:none on every posture, so only the segments matter)
        for (const [i, t] of ticks.entries()) {
          t.style.setProperty("--tf", clamp01(g - i + 1).toFixed(3));
        }
      }
    };
    updateRef.current = update;

    // ── whisper magnet: after a deliberate scroll or swipe settles, tidy the
    // page onto the nearest step. The ONE place in this codebase allowed to
    // write scroll.
    //
    // It is armed ONLY by `wheel` and `touchmove` — a real gesture. It is
    // deliberately NOT armed by the `scroll` event, which was the original
    // bug: `scroll` fires for every movement, including the ones this magnet
    // itself causes, plus resizes, anchor jumps and scroll restoration, so it
    // re-armed itself and fired with no gesture behind it. There is also no
    // idle "rescue" timer any more — the old one fired up to 2s after you had
    // stopped, which is what read as the page moving on its own — and no
    // viewport-size gate, so screen size can neither trigger nor suppress it.
    // 90ms on BOTH postures (owner: desktop should have the same scroll vibe
    // as mobile): at 160 the snap began 215–375ms after motion stopped, by
    // which point you have mentally landed and it reads as drift, not a
    // magnet. The touch gates below are a REQUIRED companion to this speed.
    const SETTLE_MS = 90;
    // iOS reports a FRACTIONAL window.scrollY and a momentum tail decays
    // through sub-pixel deltas, so exact equality never converges and the
    // magnet fires very late or not at all. Desktop keeps exact equality.
    const STILL_PX = isPhone ? 1 : 0;
    let settleTimer = 0;
    let nudgeRAF = 0;
    let nudging = false;
    let nudgeY = 0;
    let watchY = -1;
    let armed = false; // a real wheel/touchmove gesture is pending a settle
    let touching = false; // finger down — never snap under it (phone only)
    // ── the current RUN of scrolling: its direction, and where it began.
    // Sampled from the scroll POSITION, never from an input event, and
    // deliberately not from a single "where the gesture started" origin: a
    // fling that overshoots, is arrested by a planted thumb and dragged back
    // still reads as net-forward from such an origin, so the magnet would
    // carry the user the way they had just corrected AWAY from. Here a
    // reversal starts a NEW run, so the direction is always the user's last
    // real one. This only tracks — it can never arm; `armed` stays exclusive
    // to wheel/touchmove.
    let segY = 0;
    let segDir = 0;
    const trackRun = (y: number) => {
      const dy = y - watchY;
      if (Math.abs(dy) <= STILL_PX) return;
      const s = dy > 0 ? 1 : -1;
      if (s !== segDir) {
        segDir = s;
        segY = watchY; // the run starts where the direction changed
      }
    };
    // The in-flight glide's sign, and whether it is a COMMITTED end-carry
    // (the creators seam / the hero exit) — onGesture consults both so a
    // fling's own momentum tail can't kill the very glide that is finishing
    // that fling.
    let nudgeDir = 0;
    let nudgeSeam = false;
    const killNudge = () => {
      if (nudgeRAF) cancelAnimationFrame(nudgeRAF);
      nudgeRAF = 0;
      nudging = false;
      nudgeSeam = false;
    };
    const engaged = () => {
      const r = root.getBoundingClientRect();
      const READ = readLineY();
      return r.top < READ && r.bottom > READ;
    };
    // Dead-zone: never chase a pixel. Also the tidy ramp's floor.
    const DEAD = 10;
    // The glide itself — shared by the magnet's snap and the creators seam
    // jack. Fires ONCE, at the moment the gesture's motion has settled; never
    // re-scheduled. The feel is the PHONE one on both postures (owner: "same
    // scroll vibe as the mobile"): short, cubic-out, distance-aware.
    const glideBy = (best: number, advance: boolean, seam = false) => {
      const H = window.innerHeight;
      const y0 = window.scrollY;
      const t0 = performance.now();
      nudgeDir = best > 0 ? 1 : -1;
      nudgeSeam = seam;
      let D: number;
      if (advance) {
        // a carried beat can be up to a full pitch — a ramp that saturates
        // early gives every long carry the same short D, which reads as a
        // SNATCH. Scale to 0.62H so a full-beat carry gets a real runway
        // (~460ms) and short ones stay quick.
        D = 200 + 260 * clamp01(Math.abs(best) / (0.62 * H));
      } else {
        const ratio = clamp01((Math.abs(best) - DEAD) / (0.4 * H - DEAD));
        D = 200 + 180 * ratio; // 200ms tidy → 380ms for a half-gap pull
      }
      // cubic-out: starts with real velocity (inOut2's zero-velocity launch
      // measured as drift) but without quart-out's violent first frames,
      // which is what made the catch feel HEAVY — a yank instead of a pull.
      // The advance starts at speed IN YOUR OWN DIRECTION right after your
      // flick, so it reads as the page finishing your gesture.
      const ease = easeFn.out2;
      nudging = true;
      nudgeY = y0;
      // iOS rounds window.scrollTo to device pixels while reporting a
      // fractional scrollY, and a URL-bar / visual-viewport shift moves the
      // offset with no user input — 1.5px self-tripped and the glide stopped
      // half-done ("it starts then gives up"). A real gesture still cancels
      // through onGesture/onTouchStart before this is ever consulted.
      const SLIP = isPhone ? 4 : 1.5;
      const stepFrame = (now: number) => {
        if (!nudging) return;
        // an external scroll (scrollbar drag, programmatic) wins instantly
        if (Math.abs(window.scrollY - nudgeY) > SLIP) {
          killNudge();
          return;
        }
        const t = Math.min(1, (now - t0) / D);
        nudgeY = y0 + best * ease(t);
        window.scrollTo(0, nudgeY);
        if (t < 1) nudgeRAF = requestAnimationFrame(stepFrame);
        else killNudge();
      };
      stepFrame(t0);
    };
    const nudge = () => {
      if (reduced || nudging || introBusyRef.current) return;
      const H = window.innerHeight;
      const READ = readLineY();
      // ── the creators seam ────────────────────────────────────────────────
      // MEASURED (1440×900): once the magnet has snapped the pledge stack
      // onto the reading line there are only 442px of section left below it,
      // so `engaged()` — which ends the moment the story's bottom edge passes
      // the reading line — is open for less than one trackpad flick. That is
      // why the jack "doesn't work on desktop": the end guard below is
      // correct but a single flick clears its window before the settle timer
      // ever fires, and the phone only hid it because its finale runway is
      // deeper. So the seam is tested FIRST, off the section's own bottom
      // edge instead of the reading line, and off the same downward-run gate.
      //
      // The band is narrow by construction: `#creators` starts exactly at
      // this section's bottom, so `r.bottom` IS the next section's top —
      // above DEAD you have not arrived and the jack aligns it with the
      // viewport top; at or below it you are already inside creators and
      // nothing moves. A fling that overshoots past creators entirely leaves
      // `r.bottom` negative, so the magnet stays out of it.
      if (root.getBoundingClientRect().bottom <= READ) {
        // Only a real UPWARD run blocks the seam — direction UNKNOWN must
        // RESUME it. A momentum-tail wheel tick landing mid-glide kills the
        // jack through onGesture and rebases the run (segDir 0); the
        // re-settle then arrived here, hit the old `!== 1` gate and bailed,
        // stranding the page half-way into the seam ("the scroll jack
        // glitches sometimes and doesn't work"). Nothing but a downward
        // action can park you mid-seam with no direction on record, so
        // resuming down is the only correct read of segDir === 0 here.
        if (segDir === -1) return;
        const next = document.getElementById("creators");
        // measured adjacent (both edges at 4511 at 1440×900), but read the
        // destination itself rather than trusting that
        const nt = next
          ? next.getBoundingClientRect().top
          : root.getBoundingClientRect().bottom;
        if (nt <= DEAD) return; // already at / inside the next section
        glideBy(nt, true, true); // advance ramp + end-carry: momentum-proof
        return;
      }
      // parked in another section — the magnet must never drag users into
      // the story from the hero or the FAQ
      if (!engaged()) return;
      // Snap targets, in document order. For the tall phone FINALE step we snap
      // to its TITLE and then each extra (pledge stack, CTA) rather than the
      // step's geometric centre (which sits deep in its runway) — so a swipe
      // lands on the next beat and the pledge/CTA can't slide straight past.
      const targets: HTMLElement[] = [];
      for (let i = 0; i < recs.length; i++) {
        const r = recs[i];
        if (i === recs.length - 1 && r.extras.length) {
          targets.push(r.anchor); // the finale title
          // the pledge stack + CTA are ONE closing screen, so ONE beat: the
          // stack is the last snap target (the CTA sits just below it on the
          // same screen). Being last, the end guard lets a downward scroll
          // past it leave for the next section unfought.
          targets.push(r.extras[0]);
        } else {
          // r.anchor — the title on phone, the step box on desktop — so the
          // snapped resting position is exactly the engine's assembled one
          targets.push(r.anchor);
        }
      }
      // same measure the engine assembles at, so a snap lands exactly where
      // the text is composed (see anchorY)
      const offs = targets.map((t) => anchorY(t) - READ);
      let best = Number.POSITIVE_INFINITY; // signed: nearest target centre − READ
      let bestIdx = -1;
      for (let i = 0; i < offs.length; i++) {
        if (Math.abs(offs[i]) < Math.abs(best)) {
          best = offs[i];
          bestIdx = i;
        }
      }
      if (bestIdx < 0 || !Number.isFinite(best)) return;
      // ── near-pagination (both postures — the phone feel, per the owner) ──
      // Nearest-wins is why the snap read as weak: after a real swipe you are
      // usually PAST one beat and short of the next, so the nearest target is
      // the beat you just LEFT and the magnet UNDOES your gesture. If the last
      // RUN of travel (segDir/segY — reversal-aware, so a corrected fling
      // counts its correction, not its start) was a deliberate flick, finish
      // it instead: land on the first beat still AHEAD, in that direction.
      //
      // Why this cannot fight you: the chosen target satisfies
      // offs[i]·segDir > 0, so `best` always carries the sign of the gesture.
      // The advance glide is STRUCTURALLY incapable of moving you against
      // your own direction; the only backward motion the magnet can still
      // produce is the unchanged nearest-tidy, bounded by half a beat.
      let advance = false;
      if (segDir !== 0) {
        let aheadIdx = -1;
        for (let i = 0; i < offs.length; i++) {
          if (
            offs[i] * segDir > 0 &&
            (aheadIdx < 0 || Math.abs(offs[i]) < Math.abs(offs[aheadIdx]))
          ) {
            aheadIdx = i;
          }
        }
        if (aheadIdx >= 0) {
          const backIdx = aheadIdx - segDir;
          const pitch =
            backIdx >= 0 && backIdx < offs.length
              ? Math.abs(offs[aheadIdx] - offs[backIdx])
              : Math.abs(offs[aheadIdx]);
          const travel = Math.abs(window.scrollY - segY);
          // Lower bound: a deliberate flick, not thumb drift (~97px at 812) —
          // a reading-adjustment scroll must NOT page-turn; that trigger-
          // happiness is what read as heavy. Upper bound: a run that already
          // covered more than a beat has chosen its own landing spot —
          // carrying it further would be overriding, not assisting. The bound
          // also keeps any bogus origin inert (the largest phantom this
          // engine can produce, the intro's body-pin release, is several
          // beats wide and so always falls outside it).
          if (travel >= 0.12 * H && travel <= 1.25 * Math.max(1, pitch)) {
            best = offs[aheadIdx];
            bestIdx = aheadIdx;
            advance = true;
          }
        }
      }
      // The dead-zone is checked AFTER the advance choice — a committed
      // advance must not be vetoed just because the beat you LEFT happens to
      // be within 10px.
      if (Math.abs(best) <= DEAD) return;
      // No phone capture cap. It used to bail past 40vh, which is exactly what
      // let one big fling coast through the whole story untouched: land
      // anywhere in a gap and nothing caught you. Since `best` is the distance
      // to the NEAREST beat it is bounded by half a gap anyway, `engaged()`
      // already keeps this inside the story, and both end guards still stop it
      // pulling you back to the hero or holding you off the next section — so
      // always tidying onto the nearest beat catches the fling without ever
      // adding a second required swipe.
      // The ENDS. The bottom SCROLL-JACKS the seam into the creators section
      // on BOTH postures now (owner: "I want this section to scroll jack from
      // before it going to this"); the phone keeps its free upward exit. The
      // DESKTOP top is different again (owner: "when I
      // move up it shouldn't go up"): above step one there is only the raw
      // hero→story seam, so an uncommitted up-drift snaps BACK onto step one,
      // and a committed up-flick (the same 0.12·H bar as the advance) glides
      // the page all the way onto the hero instead of leaving it parked
      // mid-seam. A continuous slow crawl still escapes: the run's travel
      // accumulates until it clears the bar and commits.
      let seamCarry = false; // an end-carry glide — momentum-tail-proof
      if (bestIdx === 0 && best > 0) {
        if (isPhone) return;
        const travel = Math.abs(window.scrollY - segY);
        if (segDir === -1 && travel >= 0.12 * H) {
          // committed exit: land with the hero fully in view (clamped at the
          // document top), on the same carry ramp as a forward advance
          best = Math.max(
            root.getBoundingClientRect().top - H,
            -window.scrollY,
          );
          advance = true;
          seamCarry = true;
        }
        // else: best stays positive — the glide pulls back down onto step one
      }
      if (bestIdx === targets.length - 1 && best < 0 && segDir === 1) {
        // Scroll-jack the seam on BOTH postures (owner: "scrolljack from the
        // section before it to this one", then "I want this section to scroll
        // jack from before it going to this" for the laptop): a downward
        // gesture that leaves the pledge screen glides the page onto the
        // creators section's top, the mirror of the desktop top boundary's
        // hero glide. Desktop no longer gets a free downward exit here.
        //
        // The `segDir === 1` gate matters — and it lives IN the condition,
        // not as an early return, so a non-downward run falls through to the
        // plain tidy below (with best < 0 that pulls UP onto the stack, i.e.
        // WITH the gesture): best < 0 also holds when an UPWARD gesture from
        // the next section lands short of the pledge beat, and this used to
        // jack the page back DOWN against the user's own gesture — the
        // comment always promised the gate, the code shipped without it
        // ("glitches sometimes"). The creators entrance trigger (onceInView
        // 70 on phone, the pin on desktop) crosses during the glide, so the
        // spin plays as the page lands — and the entrance's own hold takes
        // the page over the moment that glide goes still (see holdScroll
        // there).
        const next = document.getElementById("creators");
        if (!next) return;
        const nt = next.getBoundingClientRect().top;
        if (nt <= DEAD) return; // already at/inside the next section
        best = nt; // align its top with the viewport top
        advance = true; // the full-seam carry gets the advance ramp's runway
        seamCarry = true;
      }
      glideBy(best, advance, seamCarry);
    };
    // Wait for the gesture AND its momentum to finish. A touch flick keeps
    // scrolling long after touchmove stops, so settling on the event alone
    // would fight the fling; poll until the position holds still.
    const waitForStill = () => {
      // finger still on the glass: a reader who pauses mid-drag must never get
      // a snap under their thumb — their next touchmove would kill it and the
      // page would lurch and stop.
      if (touching) {
        settleTimer = window.setTimeout(waitForStill, SETTLE_MS);
        return;
      }
      const y = window.scrollY;
      // the 90ms poll is where a fling's post-touchend momentum is observed,
      // so it is where a reversal must be caught
      trackRun(y);
      if (Math.abs(y - watchY) > STILL_PX) {
        watchY = y;
        settleTimer = window.setTimeout(waitForStill, SETTLE_MS);
        return;
      }
      armed = false;
      nudge();
      segDir = 0; // the run has been spent — the next one starts fresh
    };
    // Every real gesture cancels an in-flight nudge — the magnet can never
    // fight you — and restarts the settle watch. ONE exception, below: a
    // same-direction wheel tick during a committed end-carry.
    const onGesture = (e?: Event) => {
      // While the opening statement holds the page, holdInput() swallows
      // wheel/touchmove for SCROLLING — but passive listeners still receive
      // the prevented events, and a mouse wheel / trackpad keeps emitting
      // momentum events for up to ~1s after the flick that triggered the
      // scroll-jack. Treating those as "the user moved" cleared the park
      // milliseconds into the statement, so step one assembled at natural
      // targets BEHIND the opaque overlay — "the text doesn't animate at
      // all on laptop". A lifted finger emits no trailing touchmove, which
      // is why phone never showed it. The pinned body also freezes scrollY
      // at 0, so tracking a run from here would bank a fake lockedY-sized
      // travel the moment the hold releases. Input during the lock does
      // not exist — for the intro floors OR the magnet. The fail-open this
      // guard defers ("step one must never stay hidden") is not lost: busy
      // clears at the cut, before scroll is actually free, so any gesture
      // that can MOVE the page still lands below and clears the park.
      if (introBusyRef.current) return;
      // A wheel tick in the SAME direction as an in-flight end-carry glide
      // (the creators seam, the hero exit) is the fling's own momentum tail,
      // not a new gesture — a trackpad keeps emitting them, in bursts with
      // >90ms gaps, for up to ~1s after the flick. Killing the glide on one
      // froze the page mid-seam and re-settled it 90ms later at best — the
      // stutter half of "the scroll jack glitches sometimes". The glide IS
      // finishing that gesture, so let it. An OPPOSITE-direction tick (the
      // user changed their mind) and any touchmove (a planted finger) still
      // kill it like every other gesture.
      if (
        nudging &&
        nudgeSeam &&
        e instanceof WheelEvent &&
        Math.sign(e.deltaY) === nudgeDir
      ) {
        return;
      }
      introBoostRef.current = false; // the user moved — natural targets win
      introParkRef.current = false; // …and step one must never stay hidden
      barsHeldRef.current = false; // …and the bar must never stay pinned empty
      if (!armed) {
        // a fresh burst inherits no direction or origin from the last one
        segDir = 0;
        segY = window.scrollY;
        watchY = segY;
      }
      trackRun(window.scrollY);
      armed = true; // ONLY wheel/touchmove ever set this
      killNudge();
      clearTimeout(settleTimer);
      watchY = window.scrollY;
      settleTimer = window.setTimeout(waitForStill, SETTLE_MS);
    };
    const INPUT_EVENTS = ["wheel", "touchmove"];
    for (const ev of INPUT_EVENTS) {
      window.addEventListener(ev, onGesture, { passive: true });
    }
    // Phone-only GATES. Neither ARMS the magnet — `armed` stays exclusive to
    // wheel/touchmove — they only stop it snapping under a finger, and let a
    // finger planted to arrest a glide cancel it instantly.
    const onTouchStart = () => {
      touching = true;
      // a new finger is a new run: do NOT inherit the direction or the origin
      // of the momentum it is arresting. This does not arm anything — it only
      // re-bases the run so `travel` measures THIS interaction.
      segDir = 0;
      segY = window.scrollY;
      watchY = segY;
      killNudge();
    };
    const onTouchEnd = () => {
      touching = false;
      if (!armed) return; // a tap with no touchmove is not a gesture
      clearTimeout(settleTimer);
      watchY = window.scrollY;
      settleTimer = window.setTimeout(waitForStill, SETTLE_MS);
    };
    if (isPhone) {
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    }
    // keydown/pointerdown only retire the intro boost; they never arm the
    // magnet, so a stray keypress or click cannot move the page.
    const onKeyOrPoint = () => {
      introBoostRef.current = false;
    };
    window.addEventListener("keydown", onKeyOrPoint, { passive: true });
    window.addEventListener("pointerdown", onKeyOrPoint, { passive: true });

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
        // NOTE: the magnet is deliberately NOT armed here. Reading position
        // is all this listener may do.
      });
    };

    const measureAll = () => {
      for (const r of recs) measureLines(r);
    };
    let lastW = window.innerWidth;
    const onResize = () => {
      // Chrome Android / iOS Safari fire `resize` every time the URL bar
      // collapses or expands. Line breaking depends on WIDTH only, and
      // re-running layout() there rewrote mgEl.style.top from the new
      // innerHeight — physically yanking the sticky stamp (and the WebGL
      // canvas with it) mid-scroll, and re-firing E3's ResizeObserver into a
      // full geometry rebuild. It also re-measured every word mask.
      if (isPhone && window.innerWidth === lastW) {
        onScroll();
        return;
      }
      lastW = window.innerWidth;
      layout();
      onScroll();
      measureAll();
    };
    const onMq = () => {
      layout();
      update();
      measureAll();
    };
    const onLoad = () => update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    mqM.addEventListener("change", onMq);
    if (document.readyState !== "complete") {
      window.addEventListener("load", onLoad);
    }

    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) measureAll();
    });

    // No pre-warm for the other story: BOTH postures' two step sets reference
    // the identical four files now, so a mode flip has nothing new to fetch —
    // the old loop only cost four redundant decodes at mount.

    layout();
    update();
    // Re-measure the moment the photo reports real dimensions. decode() alone
    // was not enough: these <img> are loading="lazy", so on a cold load decode()
    // can sit unresolved and the panel kept whatever aspect layout() guessed —
    // which is how the phone stamps ended up square. A `load` listener always
    // fires, and if the image is already complete we re-layout immediately.
    const onImgLoad = () => {
      if (!alive) return;
      layout();
      update();
    };
    const firstImg = firstImage();
    if (firstImg) {
      if (firstImg.complete && firstImg.naturalWidth > 0) {
        onImgLoad();
      } else {
        firstImg.addEventListener("load", onImgLoad, { once: true });
      }
      firstImg
        .decode?.()
        .then(onImgLoad)
        .catch(() => {});
    }

    // ── the chase loop: odometer + ticks ride a smoothed g; steps chase
    // their targets and are painted only while still moving
    let rafId = 0;
    let gs = -1; // off-value so the first frame paints the progress UI
    let tLast = performance.now();
    const textLoop = (now: number) => {
      rafId = requestAnimationFrame(textLoop);
      const dt = Math.min((now - tLast) / 1000, 0.05);
      tLast = now;
      const k = 1 - Math.exp(-dt * 7);
      // Scroll-chasing runs at rate 7, but the INTRO's step-one assembly is
      // driven through the same lerp — and at 7 it converges in ~0.2s,
      // which compresses the stagger into a blur. Phone shipped rate 3 for
      // exactly this ("the animation is too fast"); the desktop chase kept
      // 7, which is why "the text animates after peel on phone only" — it
      // read as already-there. While the boost is on both postures slow the
      // lerp so the walk-in takes ~1s; desktop needs a LOWER rate for the
      // same duration because paintStep saturates its ramp at sp = 0.75
      // (a = sp/0.75), cutting the exponential's tail off early. Ordinary
      // scrolling is untouched — the first real gesture clears the boost.
      const kk = introBoostRef.current
        ? 1 - Math.exp(-dt * (isPhone ? 3 : 1.6))
        : k;
      // While the intro holds the bar (phone), pin the progress scalar one
      // whole step BELOW the first, so every bar reads empty. Releasing it at
      // the bar's cue lets this chase up to g and the FIRST bar fills on
      // screen — it used to reach full long before the bar faded in, so the
      // fill was never seen and bar one just appeared already-complete.
      const gT = barsHeldRef.current ? -1 : gRef.current;
      if (Math.abs(gT - gs) > 0.0004) {
        gs += (gT - gs) * k;
        if (Math.abs(gT - gs) < 0.0004) gs = gT;
        // Flat segments only, on every posture: the numeric odometer is
        // display:none everywhere and the tick "thump" is pinned flat by the
        // stylesheet (`transform: none !important`), so neither is computed
        // any more — the bar is just its fill sweep.
        ticks.forEach((t, i) => {
          const tf = clamp01(gs - i + 1);
          t.style.setProperty("--tf", tf.toFixed(3));
        });
      }
      // ── PHONE: one smoothed scalar drives every step's text. ─────────────
      // The per-step chase below was exactly equivalent to this while every
      // step's input sat inside its ±3 clamp — the recurrence is linear with
      // weights summing to 1 — but the clamp was a nonlinearity, and it broke
      // the equivalence in the direction that hurts. Measured at a 3000px/s
      // fling: the arriving step's input pinned at +3 while the true value was
      // higher, so it crossed into legibility ~108px EARLY, and the leaving
      // step's pinned at −3 lingered ~40px late — ~140px of scroll with BOTH
      // headlines legible. Smoothing the POSITION instead means every painted
      // frame is one self-consistent configuration of the story, so "only one
      // step's text is ever legible" is a per-frame guarantee, not a property
      // of the targets alone.
      if (isPhone) {
        if (!Number.isFinite(pS)) {
          pS = pT; // first frame lands on the truth — never flies in
        } else if (Math.abs(pT - pS) > 0.05) {
          // kk: the shared intro-boost rate — see its definition above
          pS += (pT - pS) * kk;
          // Bound what the text may owe the scroll. Uncapped, a hard fling
          // leaves ~v/7 px outstanding (≈430px at 3000px/s), so the story
          // keeps walking through a beat and a half AFTER the finger is gone
          // — and it fights the magnet, which fires 90ms after you stop. Half
          // the shortest beat keeps the inertia and kills the overrun; it
          // also bounds the sweep after any teleport (resize, mode swap).
          if (pS < pT - lagCap) pS = pT - lagCap;
          else if (pS > pT + lagCap) pS = pT + lagCap;
          if (Math.abs(pT - pS) <= 0.05) pS = pT;
        }
        for (let i = 0; i < recs.length; i++) {
          const r = recs[i];
          const d = relStep[i] - pS;
          // Asymmetric half-beat: normalise by the half-gap on the side the
          // step is actually on (see update()). For every adjacent pair the
          // two facing radii are 0.9725 × (p/2) and sum to 0.9725p < p, so
          // their legible intervals cannot overlap at ANY pS.
          const s = d / (d >= 0 ? halfUp[i] : halfDown[i]);
          const was = r.sS;
          r.sS = s;
          // Past |s| ≥ 1 paintStep's output is constant (every word parked at
          // ±140%, opacity 0, visibility hidden) and depends only on the
          // sign, so a repaint is pure waste — but a sign flip must draw.
          if (Math.abs(s) >= 1 && Math.abs(was) >= 1 && s >= 0 === was >= 0) {
            continue;
          }
          paintStep(r);
        }
        return; // the desktop per-step chase below never runs on phone
      }
      for (const r of recs) {
        if (
          Math.abs(r.target - r.sp) < 0.0006 &&
          Math.abs(r.lvT - r.lv) < 0.0006 &&
          r.done
        ) {
          continue;
        }
        r.sp += (r.target - r.sp) * kk;
        r.lv += (r.lvT - r.lv) * kk;
        r.done =
          Math.abs(r.target - r.sp) < 0.0006 && Math.abs(r.lvT - r.lv) < 0.0006;
        if (r.done) {
          r.sp = r.target;
          r.lv = r.lvT;
        }
        paintStep(r);
      }
    };
    // reduced motion: no loop at all — update() paints the static states and
    // the CSS block pins text fully assembled
    if (!reduced) rafId = requestAnimationFrame(textLoop);

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onLoad);
      mqM.removeEventListener("change", onMq);
      for (const ev of INPUT_EVENTS) window.removeEventListener(ev, onGesture);
      if (isPhone) {
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      }
      window.removeEventListener("keydown", onKeyOrPoint);
      window.removeEventListener("pointerdown", onKeyOrPoint);
      clearTimeout(settleTimer);
      killNudge();
      for (const cancel of finaleReveals) cancel();
      // undo the phone off-beat hide so a remount never starts invisible
      for (const r of recs) {
        r.title?.style.removeProperty("visibility");
        r.body?.style.removeProperty("visibility");
      }
      // …and the closing-screen retire of the sticky stamp / progress bar
      mgEl.style.removeProperty("opacity");
      mgEl.style.removeProperty("pointer-events");
      if (capEl) {
        capEl.style.removeProperty("opacity");
        capEl.removeAttribute("data-closing");
      }
      updateRef.current = () => {};
      layoutRef.current = () => {};
      stepsRef.current = [];
    };
    // isPhone is fixed for this mounted instance (a posture change remounts the
    // whole story via its key), so this still runs exactly once — the dep just
    // keeps the engine honest about the node set it bound to.
  }, [isPhone]);

  // E0 — which script to tell. The story used to carry its own toggle asking
  // "Where are you at?" with the same two labels the intro gate now asks on
  // the first screen, so the answer comes from there instead. Read once the
  // intro resolves: the pick is recorded before that, and if nobody ever
  // chose (idle backstop, reduced motion, no gate) it stays on "idea".
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

  // E2 — variant application: after React swaps the copy, re-collect the
  // word spans, re-measure lines, and repaint every step at its CURRENT
  // smoothed state — otherwise fresh spans flash unstyled for a frame and
  // parked steps would stay hidden (their chase already read "done").
  useLayoutEffect(() => {
    modeRef.current = mode;
    const recs = stepsRef.current;
    if (!recs.length) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    for (const r of recs) {
      r.words = Array.from(
        r.el.querySelectorAll<HTMLElement>("[data-ev-word]"),
      );
      r.bodyWords = Array.from(
        r.el.querySelectorAll<HTMLElement>("[data-ev-bodyword]"),
      );
      measureLines(r);
      r.done = false;
      if (!reduced) paintStep(r); // reduced mode is styled by CSS alone
    }
    layoutRef.current();
    updateRef.current();
    peelRef.current?.setMode(mode);
  }, [mode]);

  // E3 — corner-peel page transitions (THREE.js). Loads lazily; any failure
  // (no WebGL2, image error, chunk error) leaves the scene crossfade as the
  // fallback, exactly like the reference.
  useEffect(() => {
    const root = rootRef.current;
    const mount = peelMountRef.current;
    if (!root || !mount) return;
    const mediaEl = root.querySelector<HTMLElement>("[data-ev-media]");
    if (!mediaEl) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const clamp = (v: number, a: number, b: number) =>
      Math.min(b, Math.max(a, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // posture is fixed for this instance, so the peel loads exactly the photo
    // set that will ever be shown (phones never fetch the desktop 5-step set)
    const IDEA_SRCS = (isPhone ? IDEA_STEPS_M : IDEA_STEPS).map((s) => s.img);
    const PRODUCT_SRCS = (isPhone ? PRODUCT_STEPS_M : PRODUCT_STEPS).map(
      (s) => s.img,
    );
    const UNIQUE = Array.from(new Set([...IDEA_SRCS, ...PRODUCT_SRCS]));

    let alive = true;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let disposeFns: Array<() => void> = [];

    const boot = async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        beacon("peel-fallback", { stage: "import" });
        return;
      }
      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = src;
        });
      let imgs: Record<string, HTMLImageElement>;
      let stampImg: HTMLImageElement;
      try {
        const all = await Promise.all([
          ...UNIQUE.map(loadImg),
          loadImg("/assets/stamp-mask.svg"),
        ]);
        stampImg = all[all.length - 1];
        imgs = {};
        UNIQUE.forEach((src, i) => {
          imgs[src] = all[i];
        });
      } catch {
        beacon("peel-fallback", { stage: "images" });
        return;
      }
      if (!alive) return;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          // 4x MSAA resolve is the single most expensive per-frame GPU cost on
          // a phone, for a panel only ~422 CSS px wide. dpr 1.5 (below)
          // supersamples enough to keep the curl's silhouette clean.
          antialias: !isPhone,
          powerPreference: "high-performance",
        });
      } catch {
        return; // no WebGL2 — crossfade stays
      }
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      const scene3 = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      const LIGHT = new THREE.Vector3(-0.35, 0.55, 0.78).normalize();
      // 160 across a ~422 CSS-px phone panel is 25,921 verts / 51,200 tris PER
      // SHEET. 64 still lands ~19 segments across the curl arc, and the arc
      // compresses on screen so the facets stay sub-6px.
      const SEG = isPhone ? 64 : 160;
      const PEEL_K = 1.5;
      const P = {
        radiusR: 70,
        curl: 89,
        curlLength: 0.647,
        backOpacity: 1,
        frost: 1,
        shading: 0,
        shadingSoft: 50,
        sheen: 0.72,
        shadow: 0.31,
        shadowSoft: 0,
      };
      // Every sheet peels the SAME way as the first, on BOTH postures (per
      // the owner) — a single entry, since layers index PEELS[i % PEELS.length].
      const PEELS = [{ ox: 87.96, oy: 83.55, ang: 145.81 }]; // bottom-right → up-left

      // stamp alpha texture — NOTE: no texture.colorSpace anywhere; raw
      // ShaderMaterial sampling must match the reference's linear pipeline
      const scv = document.createElement("canvas");
      scv.width = 1024;
      scv.height = Math.round(
        (1024 * stampImg.naturalHeight) / stampImg.naturalWidth,
      );
      scv.getContext("2d")?.drawImage(stampImg, 0, 0, scv.width, scv.height);
      const stampTex = new THREE.CanvasTexture(scv);
      stampTex.minFilter = THREE.LinearFilter;
      stampTex.magFilter = THREE.LinearFilter;
      stampTex.generateMipmaps = false;
      stampTex.wrapS = stampTex.wrapT = THREE.ClampToEdgeWrapping;

      const texBySrc = new Map<string, import("three").Texture>();
      for (const src of UNIQUE) {
        const tx = new THREE.Texture(imgs[src]);
        tx.needsUpdate = true;
        tx.minFilter = THREE.LinearFilter;
        tx.magFilter = THREE.LinearFilter;
        tx.generateMipmaps = false;
        tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
        texBySrc.set(src, tx);
      }

      let activeSrcs = modeRef.current === "product" ? PRODUCT_SRCS : IDEA_SRCS;
      const layers = activeSrcs.map((src, i) => {
        const u = {
          uMap: { value: texBySrc.get(src) as import("three").Texture },
          uStamp: { value: stampTex },
          uRepeat: { value: new THREE.Vector2(1, 1) },
          uOffset: { value: new THREE.Vector2(0, 0) },
          uCorner: { value: new THREE.Vector2() },
          uDir: { value: new THREE.Vector2() },
          uCrease: { value: 0 },
          uRadius: { value: 0.3 },
          uBackOpacity: { value: P.backOpacity },
          uFrost: { value: P.frost },
          uShading: { value: P.shading },
          uShadingSoft: { value: P.shadingSoft },
          uSheen: { value: P.sheen },
          uShadow: { value: P.shadow },
          uShadowSoft: { value: P.shadowSoft },
          uFade: { value: 1 },
          uLight: { value: LIGHT },
        };
        const m = new THREE.Mesh(
          new THREE.BufferGeometry(),
          new THREE.ShaderMaterial({
            uniforms: u,
            vertexShader: VERT,
            fragmentShader: FRAG,
            side: THREE.DoubleSide,
            transparent: true,
            depthTest: true,
            depthWrite: true,
          }),
        );
        m.position.z = (activeSrcs.length - 1 - i) * 0.004;
        m.renderOrder = activeSrcs.length - i;
        scene3.add(m);
        return { u, m, cur: 0, sMax: 1, tMin: 0 };
      });
      const radius = clamp(
        lerp(0.5, 0.06, P.curl / 100) *
          lerp(0.6, 1.7, P.curlLength) *
          lerp(0.6, 1.5, P.radiusR / 100),
        0.02,
        2.0,
      );

      let aspect = 1;
      let geo: import("three").PlaneGeometry | null = null;
      // the sheet matches the media panel (E1's layout() owns the panel's
      // size — this only reads it)
      const build = () => {
        aspect = (mediaEl.clientWidth || 1) / (mediaEl.clientHeight || 1);
        if (geo) geo.dispose();
        geo = new THREE.PlaneGeometry(aspect, 1, SEG, SEG);
        layers.forEach((L, i) => {
          const pe = PEELS[i % PEELS.length];
          const c = L.u.uCorner.value;
          const d = L.u.uDir.value;
          c.set((pe.ox / 100 - 0.5) * aspect, 0.5 - pe.oy / 100);
          const ang = (pe.ang * Math.PI) / 180;
          d.set(Math.cos(ang), Math.sin(ang));
          L.sMax = 0;
          L.tMin = 0;
          const corners = [
            [-aspect / 2, -0.5],
            [aspect / 2, -0.5],
            [-aspect / 2, 0.5],
            [aspect / 2, 0.5],
          ];
          for (const p of corners) {
            const t = (p[0] - c.x) * d.x + (p[1] - c.y) * d.y;
            L.sMax = Math.max(L.sMax, t);
            L.tMin = Math.min(L.tMin, t);
          }
          L.tMin -= 0.001; // fully flat at rest
          L.m.geometry = geo as import("three").PlaneGeometry;
          const img = imgs[activeSrcs[i]];
          const imgAspect = img.naturalWidth / img.naturalHeight || 1;
          if (imgAspect > aspect) {
            L.u.uRepeat.value.set(aspect / imgAspect, 1);
            L.u.uOffset.value.set((1 - aspect / imgAspect) / 2, 0);
          } else {
            L.u.uRepeat.value.set(1, imgAspect / aspect);
            L.u.uOffset.value.set(0, (1 - imgAspect / aspect) / 2);
          }
          L.u.uRadius.value = radius;
        });
        // camera shows the padded mount; the sheet sits at the panel's spot
        const px = (mount.clientWidth || 1) / (mediaEl.clientWidth || 1);
        const py = (mount.clientHeight || 1) / (mediaEl.clientHeight || 1);
        camera.left = (-aspect / 2) * px;
        camera.right = (aspect / 2) * px;
        camera.top = 0.5 * py;
        camera.bottom = -0.5 * py;
        camera.updateProjectionMatrix();
      };

      let tg = gRef.current;
      let introT0 = 0; // >0 while the entrance drives the first sheet
      let needsRender = true;
      // Cached mount size. Reading mount.clientWidth inside frame() forced a
      // synchronous style recalc + layout EVERY rAF tick — flushing all the
      // inline styles textLoop had just written — and it kept doing that for
      // the life of the page, including while the user is on other sections.
      // The ResizeObserver already re-runs resize() on any size change.
      let mountW = 0;
      let mountH = 0;
      const resize = () => {
        if (!renderer) return;
        mountW = mount.clientWidth;
        mountH = mount.clientHeight;
        const dpr = isPhone
          ? Math.min(window.devicePixelRatio || 1, 1.5)
          : Math.min((window.devicePixelRatio || 1) * 1.25, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(mountW, mountH, false);
        build();
        needsRender = true;
      };
      mount.appendChild(renderer.domElement);
      // A lost WebGL context (mobile memory pressure) used to leave a BLANK
      // media panel for the rest of the session: the peel stayed `active`,
      // so the CSS scenes were hidden behind a canvas that would never draw
      // again, and the crossfade branch was permanently skipped. Give the
      // peel up instead and fall back to the scenes — the same degradation
      // as a failed import, just later.
      renderer.domElement.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        beacon("peel-context-lost");
        peelRef.current = null;
        mediaEl.classList.remove(styles.peelOn);
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      });
      ro = new ResizeObserver(resize);
      ro.observe(mount);
      resize();
      mediaEl.classList.add(styles.peelOn);
      peelRef.current = {
        active: true,
        setProgress: (g) => {
          tg = g;
        },
        setMode: (m) => {
          // swap texture sets in place — tg and each layer's smoothed cur
          // are untouched, so the current page keeps its exact peel state
          activeSrcs = m === "product" ? PRODUCT_SRCS : IDEA_SRCS;
          layers.forEach((L, i) => {
            L.u.uMap.value = texBySrc.get(
              activeSrcs[i],
            ) as import("three").Texture;
          });
          build();
          needsRender = true;
        },
        entrance: () => {
          if (layers.length < 2) return;
          layers[0].cur = 100; // start fully rolled off its corner
          introT0 = performance.now();
          needsRender = true;
        },
      };

      let last = performance.now();
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (!mountW) return; // hidden — cached by resize(), never read per frame
        const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
        let moving = false;
        // intro entrance: the first sheet is driven by the clock, easing
        // from fully rolled off its corner back down flat — the peel played
        // in reverse. The scroll chase takes back over once it lands.
        const entering = introT0 > 0;
        if (entering) {
          // phone rolls in slower — the whole intro sequence reads too fast at
          // desktop's pace, and this is its opening beat
          // phone rolls in a little slower than desktop, but both were cut
          // back twice (owner: "just a bit too long", then "make the text
          // appear after the evan peel a bit quicker" — the text cue is tied
          // to this roll-in landing, so the peel came down with it) —
          // 1300/900, then 950/700 before
          const p = Math.min(1, (now - introT0) / (isPhone ? 800 : 550));
          layers[0].cur = 100 * (1 - easeOut(p));
          if (p >= 1) {
            layers[0].cur = 0;
            introT0 = 0;
          }
          moving = true;
        }
        layers.forEach((L, i) => {
          if (i === layers.length - 1) return; // bottom page never peels
          if (i === 0 && entering) return; // the entrance owns this sheet
          const t = clamp((tg - i - 0.28) / 0.44, 0, 1) * 100;
          if (Math.abs(t - L.cur) < 0.001) {
            L.cur = t;
            return;
          }
          L.cur += (t - L.cur) * k;
          if (Math.abs(t - L.cur) < 0.001) L.cur = t;
          moving = true;
        });
        if (!moving && !needsRender) return; // at rest: draw nothing
        layers.forEach((L, i) => {
          L.u.uCrease.value =
            L.tMin + (L.cur / 100) * (L.sMax * PEEL_K - L.tMin);
          // Alpha is BINARY: a sheet of paper is opaque until it is gone.
          // This used to ramp out over the last 8% of the curl
          // (clamp((100 - cur) / 8, 0, 1)), and that partial-alpha window is
          // what read as the picture blinking as it changed — the sheet went
          // see-through for a moment and the mint stamp behind it showed
          // through. The 1.5x PEEL_K overshoot already carries the sheet
          // fully off the plane, so there is nothing left to hide by fading.
          L.u.uFade.value = entering
            ? i === 0
              ? 1
              : 0
            : L.cur >= 99.5
              ? 0
              : 1;
        });
        if (isPhone) {
          // Draw only sheets that can be SEEN. The peel windows
          // [i+0.28, i+0.72] never overlap, so at most one sheet is mid-curl,
          // and the flat opaque one beneath it occludes everything below.
          // The `entering` case MUST be special-cased: during the entrance
          // sheet 0 sits at cur=100, so a naive "first sheet below 99.5" pick
          // would hide the very sheet the intro is animating.
          if (entering) {
            layers.forEach((L, i) => {
              L.m.visible = i === 0;
            });
          } else {
            const front = layers.findIndex((L) => L.cur < 99.5);
            // fail-safe: if nothing qualifies, draw everything rather than
            // culling the whole stack away (a blank panel is far worse than
            // a few redundant draws)
            layers.forEach((L, i) => {
              L.m.visible = front < 0 || (i >= front && i <= front + 1);
            });
          }
        }
        (renderer as import("three").WebGLRenderer).render(scene3, camera);
        needsRender = moving;
      };
      raf = requestAnimationFrame(frame);

      disposeFns = [
        () => {
          for (const tx of texBySrc.values()) tx.dispose();
        },
        () => stampTex.dispose(),
        () => {
          for (const L of layers) {
            (L.m.material as import("three").Material).dispose();
          }
        },
        () => geo?.dispose(),
      ];
    };

    // Deferred until the intro gate has actually LEFT. This effect fetches
    // ~1 MB of story photos plus the three.js chunk, and running it at mount
    // put all of that inside the intro's own media window — starving the
    // crank/stinger on slow links AND fetching the DESKTOP photo set on
    // phones, because the desktop tree mounts first and the posture remount
    // only lands afterwards (probed live: a cold mobile load transferred
    // ~1.4 MB more than desktop). After dismissal the pipe is idle and the
    // mounted tree is the real posture. whenIntroDismissed() resolves on
    // every real end — clip finished, failure, Escape, deadline, no gate at
    // all — and the one path that never resolves it (nobody ever clicks)
    // leaves the visitor behind the opaque gate, where the peel is
    // unreachable anyway. The peel keeps its own fallback: arriving at the
    // story before boot() finishes just means the CSS crossfade carries the
    // scene until the renderer is ready.
    whenIntroDismissed().then(() => {
      if (alive) void boot();
    });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      peelRef.current = null;
      mediaEl.classList.remove(styles.peelOn);
      for (const fn of disposeFns) fn();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
    };
    // fixed per instance (see E1) — the peel loads this posture's photo set once
  }, [isPhone]);

  // E4 — the opening statement: "This is Evan…" plays once as the story
  // first scrolls in (word masks, the photo window expanding, the smiling
  // swap), then hands off — the photo fades out with the words.
  // While the statement plays, wheel/touch scrolling is HELD and the page
  // settles onto the section top — the ONE scroll lock on the site, per
  // explicit request. The hold releases the instant the overlay cuts away,
  // and every failure path (throw, cancel, unmount) releases it too.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wrap = root.querySelector<HTMLElement>("[data-ev-statement]");
    const spans = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-sword]"),
    );
    const maskEl = root.querySelector<HTMLElement>("[data-ev-photomask]");
    const photo = root.querySelector<HTMLImageElement>("[data-ev-photo]");
    const photoSmiling = root.querySelector<HTMLImageElement>(
      "[data-ev-photo-smiling]",
    );
    const media = root.querySelector<HTMLElement>("[data-ev-mg]");
    const ticksEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-tick]"),
    );
    const curtains = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-curtain]"),
    );
    if (!wrap || spans.length < 2 || !maskEl || !photo) return;

    // StrictMode/remount: undo whatever a previous run left behind
    wrap.style.display = "";
    wrap.style.transform = "";
    for (const c of curtains) c.style.transform = ""; // panels back down

    // Catastrophe net: a leftover "fixed" here that no LIVE holdScroll owns
    // can only be a pin a previous run failed to release, which would freeze
    // the WHOLE page with no recovery but reload. Clear it before anything
    // else and restore the exact scroll it was showing (parsed back out of
    // body.top), so recovery is jump-free too. Runs before the
    // reduced-motion bail so it heals that path too. hasLiveHold() is the
    // ownership check: a posture remount CAN legitimately mount this section
    // while another section's arrival hold is mid-entrance, and ripping that
    // pin out would corrupt the other owner's release (the old comment's
    // "nothing else sets body.position" stopped being true when holdScroll
    // shipped).
    if (document.body.style.position === "fixed" && !hasLiveHold()) {
      beacon("evan-net-trip");
      const leakedY = -Number.parseFloat(document.body.style.top || "0") || 0;
      const b0 = document.body.style;
      b0.position = "";
      b0.top = "";
      b0.left = "";
      b0.right = "";
      b0.width = "";
      document.documentElement.style.overscrollBehavior = "";
      introBusyRef.current = false;
      introParkRef.current = false;
      barsHeldRef.current = false;
      window.scrollTo(0, leakedY);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wrap.style.display = "none"; // land directly on the story
      return;
    }

    // Scroll position at mount. The intro plays only when the user SCROLLS
    // the section into view — if the page LOADED already sitting in it
    // (reload, deep link, browser scroll restoration), scrollY won't have
    // moved from this by the time the trigger fires, and locking + gliding a
    // visitor who never scrolled is exactly the "it drags me on reload" bug.
    const mountScrollY = window.scrollY;

    let cancelled = false;
    const timers: number[] = [];
    const anims: Animation[] = [];
    let splits: WordSplit[] = [];

    const finish = () => {
      // fail-open: the story must never stay trapped behind the overlay,
      // and no sequenced element may stay parked hidden
      wrap.style.display = "none";
      wrap.style.transform = ""; // clear a half-finished slide-up (phone)
      barsHeldRef.current = false; // never leave the progress bar pinned empty
      mediaParkedRef.current = false; // …nor the stamp parked invisible
      for (const el of ticksEls) {
        el.style.removeProperty("opacity");
        el.style.removeProperty("visibility");
      }
      media?.style.removeProperty("opacity");
      media?.style.removeProperty("transform");
    };

    // ── the intro scroll lock: while the "This is Evan…" statement plays, the
    // <body> is PINNED with position:fixed so nothing can move the page — not
    // a wheel, not a swipe, and crucially not an iOS momentum fling. The old
    // preventDefault-on-touchmove hold could not stop a phone: once the finger
    // lifts no touchmove fires, so there is nothing left to cancel, and the
    // fling that TRIGGERED the intro (the hero-jack on the first swipe, or the
    // onceInView backstop) carried the page straight past. touch-action only
    // governs the NEXT gesture, never the one already in flight. Removing the
    // document's scroll range is the only thing that freezes in-flight momentum
    // on iOS — which also makes the old wheel/touchmove preventDefault
    // redundant (nothing to scroll), so those listeners are gone. Only
    // overscroll-behavior stays, to kill Android pull-to-refresh at the pinned
    // (scrollTop 0) top.
    //
    // With the body fixed the document has no scroll range, so "scrolling" now
    // means animating body.style.top: lockedY is the virtual scroll (body.top
    // is always kept at -lockedY, which exactly compensates the real scroll at
    // the pin so nothing moves at lock). The settle glide advances lockedY;
    // unlock converts it back into a real window scroll in the SAME synchronous
    // tick, so neither lock nor unlock ever paints a jump.
    let locked = false;
    let lockedY = 0; // virtual scroll while pinned; body.top === -lockedY
    let glideRAF = 0;
    // holdInput = LOCK.
    const holdInput = () => {
      if (locked) return;
      locked = true;
      introBusyRef.current = true; // step one stays parked behind the overlay
      introParkRef.current = true; // …and stays parked past the cut, till its cue
      barsHeldRef.current = true; // bars empty until their cue (both postures)
      lockedY = window.scrollY;
      const b = document.body.style;
      b.position = "fixed";
      b.top = `${-lockedY}px`; // exactly compensates the scroll — no jump
      b.left = "0";
      b.right = "0";
      b.width = "100%"; // body { margin: 0 } + box-sizing: border-box → no x-shift
      document.documentElement.style.overscrollBehavior = "none";
    };
    // releaseHold = UNLOCK (scroll only). releaseIntro also clears introBusyRef
    // — the handoff frees scroll at the cut but keeps step one parked for a
    // beat so the text can enter on its own cue.
    const releaseHold = () => {
      if (glideRAF) cancelAnimationFrame(glideRAF);
      glideRAF = 0;
      if (!locked) return;
      locked = false;
      const b = document.body.style;
      b.position = "";
      b.top = "";
      b.left = "";
      b.right = "";
      b.width = "";
      document.documentElement.style.overscrollBehavior = "";
      // Convert the pin back into a real scroll in this SAME synchronous tick.
      // Clearing position:fixed drops the document to scrollY 0; scrollTo runs
      // before the browser paints (both mutations coalesce into one paint), so
      // that top-of-page frame is never shown — no jump — and it lands on the
      // exact position body.top was showing.
      window.scrollTo(0, lockedY);
      // E1 saw scrollY≈0 while pinned and its onScroll never fired (animating
      // body.top dispatches no scroll event), so ping update() to re-sync it
      // synchronously at the cut. Safe on every path: update() reads rects that
      // still exist during layout-effect teardown, and its peelRef call is
      // optional-chained. The scroll event scrollTo queues is a second re-sync.
      updateRef.current();
    };
    const releaseIntro = () => {
      releaseHold();
      introBusyRef.current = false;
      introParkRef.current = false;
      barsHeldRef.current = false;
    };
    // settleToTop = the intro snap. While the body is pinned the document
    // can't scroll, so glide body.style.top (that IS "scrolling" while fixed)
    // from -lockedY onto this section's top, so the statement plays parked on a
    // full screen rather than mid-boundary — same easeFn.inOut2 and the same
    // distance-aware duration as the old window.scrollTo glide. Only ever
    // reached from beginIntro, immediately after holdInput().
    const settleToTop = () => {
      if (!locked) return; // the glide moves body.top — the lock must be up
      const y0 = lockedY;
      // While pinned at body.top === -lockedY, rect.top === sectionDocY -
      // lockedY, so y0 + rect.top === the section top's absolute document
      // offset — the scroll we want to land on. Constant across the glide.
      const target = y0 + root.getBoundingClientRect().top;
      const dist = Math.abs(target - y0);
      if (dist < 2) {
        lockedY = target; // snap the last couple px so the cut lands exact
        document.body.style.top = `${-lockedY}px`;
        return;
      }
      const t0 = performance.now();
      // Distance-aware: a short settle from the 70% line stays ~400ms; the
      // full-viewport hero→Evan jack eases over up to 750ms so it reads as a
      // guided glide, not a snap.
      const D = Math.min(750, Math.max(400, dist * 0.6));
      const glide = (now: number) => {
        if (!locked) return; // unlocked = the intro is over; never chase
        const t = Math.min(1, (now - t0) / D);
        lockedY = y0 + (target - y0) * easeFn.inOut2(t);
        document.body.style.top = `${-lockedY}px`;
        if (t < 1) glideRAF = requestAnimationFrame(glide);
      };
      glideRAF = requestAnimationFrame(glide);
    };

    // park before the trigger: words hidden, the photo window shut.
    // (The mask's natural width is measured later, at reveal time — right
    // now the wrap is still display:none, since .isLive only lands after
    // this effect pass, and a display:none box measures 0px.)
    maskEl.style.visibility = "";
    maskEl.style.opacity = ""; // clear any leftover Act-2 fade (phone path)
    maskEl.style.transform = ""; // …and any leftover swell scale
    // Park the media panel — BOTH postures. E3 builds its renderer eagerly
    // and paints the first sheet FLAT the moment it is ready, and the curtain
    // wipe progressively reveals the section — so without the park you saw
    // the finished picture mid-wipe, then entrance() rolled it off and peeled
    // it back in ("the first one shows up and then disappears and animates
    // in"). Hidden until peelIn reveals it on the rolled-off frame.
    if (media) {
      media.style.opacity = "0";
      mediaParkedRef.current = true;
    }
    photo.setAttribute("src", "/assets/Evan_main.webp");
    if (photoSmiling) photoSmiling.style.opacity = "0"; // reset for remount
    for (const s of spans) park(s, { opacity: 0 });
    maskEl.style.width = "0px";

    // Make sure the smiling frame is fully decoded before it's ever shown, so
    // the opacity swap can't reveal a half-painted image on a cold cache.
    photoSmiling?.decode?.().catch(() => {});

    // The intro starts one of two ways, whichever comes first; both funnel
    // through beginIntro, which runs exactly once.
    let introStarted = false;
    let cancelIO: () => void = () => {};
    let jackTouchStartY = 0;

    // Never jack while a full-page overlay owns the screen (the intro gate on
    // load, the tablet block) — both lock body scroll.
    const bodyLocked = () =>
      getComputedStyle(document.body).overflow === "hidden";
    const removeHeroJack = () => {
      window.removeEventListener("wheel", onJackWheel);
      window.removeEventListener("touchstart", onJackTouchStart);
      window.removeEventListener("touchmove", onJackTouchMove);
    };

    // ── the ONE scroll-jack on the site: hero → Evan. The first downward
    // scroll or swipe while you're still on the hero commits a glide to the
    // section top (settleToTop covers the whole distance) and plays the intro
    // there, instead of making you hand-scroll a viewport to reach it. Only
    // here, only once — everything below Evan is native.
    const tryHeroJack = () => {
      if (introStarted || cancelled || bodyLocked()) return;
      // still on the hero → the section top is well below the fold
      if (root.getBoundingClientRect().top <= window.innerHeight * 0.5) return;
      beginIntro();
    };
    function onJackWheel(e: WheelEvent) {
      if (e.deltaY > 0) tryHeroJack(); // downward only
    }
    function onJackTouchStart(e: TouchEvent) {
      jackTouchStartY = e.touches[0]?.clientY ?? 0;
    }
    function onJackTouchMove(e: TouchEvent) {
      const y = e.touches[0]?.clientY ?? jackTouchStartY;
      if (jackTouchStartY - y > 6) tryHeroJack(); // swipe up = scroll down
    }

    const beginIntro = () => {
      if (introStarted || cancelled) return;
      introStarted = true;
      cancelIO(); // stop the onceInView path
      removeHeroJack(); // stop the gesture path
      // Lock synchronously, before the fonts wait, so a continuous scroll
      // can't slip through a gap and escape the hold.
      holdInput();
      settleToTop();
      Promise.race([
        document.fonts.ready,
        // 1500, not the house 600: the statement's word masks are measured
        // ONCE, right here — there is no re-split when Satoshi lands late
        // (the step words re-measure on fonts.ready; these don't) — and a
        // lost race on a cold cache reflows words inside overflow-hidden
        // masks mid-statement: the "text masks leave fragments" report. The
        // page is already held behind the arrival lock, so the extra wait is
        // invisible except on a genuinely font-less network, where 1.5s is
        // still a bounded cost.
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]).then(() => {
        if (cancelled) {
          releaseIntro();
          return;
        }
        try {
          // measure the photo window's natural width NOW — the wrap only
          // became visible when .isLive landed (after the effect pass), and
          // measuring a display:none box reads 0px, which kept the photo
          // from ever appearing
          maskEl.style.width = "";
          const maskWidth = maskEl.offsetWidth;
          maskEl.style.width = "0px";
          // park the sequenced arrivals while the overlay still covers
          // them — each element enters on its own cue after the handoff.
          // (The "01 / 04" counter is display:none on every posture now, so
          // only the bar segments are sequenced.)
          for (const el of ticksEls) {
            park(el, { opacity: 0 });
          }
          // Act 1 — the statement
          splits = spans.map((s) => splitWords(s));
          const words = splits.flatMap((sp) => sp.words);
          for (const s of spans) {
            s.style.opacity = "";
            s.style.visibility = "";
          }
          // the statement runs a shade quicker throughout (owner: "make the
          // this is evan intro a bit quicker") — 0.45/0.05 words, 0.5 mask,
          // longer smile dwells before
          words.forEach((w, i) => {
            anims.push(
              playFrom(
                w,
                { transform: "translateY(120%)" },
                { duration: 0.4, delay: i * 0.04, ease: EASE.out4 },
              ),
            );
          });
          const wordsEnd = 0.4 + (words.length - 1) * 0.04;
          const maskStart = Math.max(0, wordsEnd - 0.25);
          // the photo window expands while the photo settles from a zoom
          anims.push(
            playTo(
              maskEl,
              { width: `${maskWidth}px` },
              { duration: 0.45, delay: maskStart, ease: EASE.out3 },
            ),
          );
          anims.push(
            playFrom(
              photo,
              { transform: "scale(1.3)" },
              { duration: 0.45, delay: maskStart, ease: EASE.out3 },
            ),
          );
          const maskEnd = maskStart + 0.45;
          // On PHONE the photo window GROWS — in LAYOUT, not transform. It
          // animates its width (the mask is aspect-ratio: 1, so it grows both
          // ways), which reflows the flex-wrapped statement each frame and
          // physically PUSHES the words apart as he gets bigger. He smiles
          // near the top of the growth, holds there, and hands off big — no
          // zoom-in-zoom-out, no shrink back (owner: "grow and push the text,
          // don't make him bigger then smaller"). Layout animation is fine
          // here: the statement is a handful of words on their own overlay.
          // Desktop keeps the straight settle-then-smile.
          let smileAt: number;
          let exitAt: number;
          if (isPhone) {
            const GROW = 0.45;
            const HOLD = 0.4; // held BIG — the handoff takes him as he is
            const growStart = maskEnd + 0.1;
            const grownW = Math.round(
              Math.min(maskWidth * 1.75, window.innerWidth * 0.3),
            );
            // raw animate(), NOT playTo — playTo cancels every running
            // animation on the element at CALL time, and the mask's delayed
            // width reveal above is still pending when this line runs
            const grow = maskEl.animate([{ width: `${grownW}px` }], {
              duration: GROW * 1000,
              delay: growStart * 1000,
              easing: EASE.out3,
              fill: "forwards",
            });
            anims.push(grow);
            grow.finished
              .then(() => {
                maskEl.style.width = `${grownW}px`; // inline owns the end state
                grow.cancel();
              })
              .catch(() => {});
            smileAt = growStart + 0.3; // smiles as he finishes growing
            exitAt = growStart + GROW + HOLD;
          } else {
            smileAt = maskEnd + 0.25;
            exitAt = maskEnd + 0.25 + 0.4;
          }
          timers.push(
            window.setTimeout(() => {
              // instant cut to the smiling frame — reveal the pre-decoded
              // overlay, no src swap, no decode flash
              if (photoSmiling) photoSmiling.style.opacity = "1";
            }, smileAt * 1000),
          );
          // Act 2 — the handoff: words fade up and out, and the overlay cuts
          // away to the live story. No step has an avatar any more, so the
          // photo window fades out with the words on both postures instead of
          // flying anywhere.
          timers.push(
            window.setTimeout(() => {
              for (const s of spans) {
                anims.push(
                  playTo(
                    s,
                    { opacity: "0", transform: "translateY(-24px)" },
                    { duration: 0.3, ease: EASE.in2 },
                  ),
                );
              }
              anims.push(
                playTo(
                  maskEl,
                  { opacity: "0", transform: "translateY(-24px)" },
                  { duration: 0.3, ease: EASE.in2 },
                ),
              );
            }, exitAt * 1000),
          );
          // ── the handoff sequence: overlay cuts → the stamp reverse-peels
          // onto the page in place → text assembles → ticks pop one by one
          // → the counter → the mode dock. Each on its own cue.
          // the stamp's peel-in. It now rolls in at the cut on BOTH postures —
          // the IMAGE is the first thing in, and on phone the step-1 headline
          // follows it (TEXT_AT below) rather than leading it.
          const peelIn = () => {
            if (peelRef.current?.active) {
              // Set the rolled-off state FIRST, then reveal on the next frame —
              // by then E3's loop has painted `entering` (sheet 0 at cur=100,
              // i.e. fully off its corner), so the very first visible frame is
              // already mid-peel and the flat sheet never shows. Both postures.
              peelRef.current.entrance();
              if (media) {
                requestAnimationFrame(() => {
                  mediaParkedRef.current = false; // E1 may write it again now
                  media.style.opacity = "";
                });
              }
              return;
            }
            mediaParkedRef.current = false;
            if (media) media.style.opacity = "";
            if (media) {
              // no WebGL: the crossfade panel presses in like a sticker
              anims.push(
                playFrom(
                  media,
                  { opacity: 0, transform: "scale(0.94)" },
                  { duration: 0.5, ease: EASE.out3 },
                ),
              );
            }
          };
          // ── the handoff is a "Curtains: Stagger" wipe (owner), BOTH
          // postures: the white is five vertical panels that lift one after
          // another, unveiling the dark story beneath. The words + photo have
          // already faded (Act 2), so the panels carry only blank white. The
          // sequence then runs peel → text → progress bar, each cue measured
          // from when the screen is actually clear (CLEAR), not from when the
          // wipe starts.
          const CURT_D = 0.45; // one panel's lift (0.5 before the trim)
          const CURT_ST = 0.07; // the stagger between panels (was 0.08)
          const WIPE = CURT_D + Math.max(0, curtains.length - 1) * CURT_ST;
          const CLEAR = 0.1 + WIPE;
          timers.push(
            window.setTimeout(
              () => {
                // The page stays LOCKED through the wipe and everything after
                // it — see SEQ_END below. Scroll used to be freed right here,
                // at the cut.
                curtains.forEach((c, i) => {
                  anims.push(
                    playTo(
                      c,
                      { transform: "translateY(-102%)" },
                      {
                        duration: CURT_D,
                        delay: i * CURT_ST,
                        ease: EASE.inOut3,
                      },
                    ),
                  );
                });
              },
              (exitAt + 0.1) * 1000,
            ),
          );
          // the wrap leaves rendering once the last panel is clear; every
          // fail-open path still hard-hides via finish()
          timers.push(
            window.setTimeout(
              () => {
                wrap.style.display = "none";
              },
              (exitAt + CLEAR) * 1000,
            ),
          );
          // 1 — the peel. Desktop holds a deliberate 0.4s beat of bare
          // surface after the wipe (owner: "after the intro is completely
          // over hold for like 0.4s then animate it in"), then the stamp
          // rolls in; phone keeps its owner-tuned cue right at CLEAR.
          const PEEL_AT = CLEAR + (isPhone ? 0 : 0.25);
          timers.push(
            window.setTimeout(() => peelIn(), (exitAt + PEEL_AT) * 1000),
          );
          // 2 — the headline FOLLOWS the stamp (staggered off the peel, not
          // off the wipe). On desktop it waits out the WHOLE 550ms roll-in
          // plus a breath (owner: "the text should animate in after the
          // peel" — starting it mid-curl was the bug; that constraint is why
          // the roll-in itself came down when the owner asked for the text
          // "a bit quicker" after the peel); phone keeps its tuned overlap.
          // Step one stays parked (introParkRef) until this fires, so the
          // window in which scroll is free cannot expose invisible copy.
          const TEXT_AT = PEEL_AT + (isPhone ? 0.45 : 0.6);
          timers.push(
            window.setTimeout(
              () => {
                // step one assembles: the engine floors its target to 1 and
                // its own chase raises headline lines → body
                introParkRef.current = false;
                introBoostRef.current = true;
                updateRef.current();
              },
              (exitAt + TEXT_AT) * 1000,
            ),
          );
          // 3 — the progress bar, last. Releasing barsHeldRef here is what
          // makes the FIRST bar fill on screen: the progress scalar has been
          // pinned one step below the start until now, so it chases up to g
          // as the bar arrives instead of having reached full minutes earlier.
          const TICKS_AT = PEEL_AT + (isPhone ? 0.9 : 0.85);
          // one place for the segments' own timing — SEQ_END below derives the
          // tail from these, and the two drifting apart would either free the
          // page mid-pop or hold it after the last bar had landed
          const TICK_D = isPhone ? 0.42 : 0.34;
          const TICK_ST = isPhone ? 0.08 : 0.055;
          timers.push(
            window.setTimeout(
              () => {
                barsHeldRef.current = false;
                ticksEls.forEach((t, i) => {
                  anims.push(
                    playFrom(
                      t,
                      { opacity: 0, transform: "translateY(10px) scale(0.4)" },
                      {
                        duration: TICK_D,
                        delay: i * TICK_ST,
                        ease: EASE.backOut2,
                      },
                    ),
                  );
                });
                updateRef.current(); // re-gate the bar's own opacity
              },
              (exitAt + TICKS_AT) * 1000,
            ),
          );
          // 4 — and only NOW is the page handed back (owner: "disable
          // scrolling until after the entire first image and text and loaders
          // have finished animating"). The lock used to lift at the cut, which
          // left the peel, the step-one assembly and the bar's pop-in all
          // scrollable-through.
          //
          // `introBusyRef` moves with it, deliberately: busy means "the page is
          // held", and the two must not come apart. onGesture stands down while
          // busy, and it has to — a trackpad keeps emitting momentum events for
          // ~1s after the flick that triggered the jack, and those events would
          // otherwise clear introParkRef/introBoostRef/barsHeldRef mid-sequence
          // (that is the "text doesn't animate at all on laptop" bug). The
          // fail-open it defers is covered: every park is cleared by its own
          // cue above, all of them before this fires.
          //
          // The tail is the ticks' own stagger + duration — the last segment
          // starts at (n-1)·TICK_ST and runs TICK_D.
          const TICK_TAIL = Math.max(0, ticksEls.length - 1) * TICK_ST + TICK_D;
          const SEQ_END = TICKS_AT + TICK_TAIL;
          timers.push(
            window.setTimeout(
              () => {
                introBusyRef.current = false; // scroll really is free from here
                releaseHold();
              },
              (exitAt + SEQ_END) * 1000,
            ),
          );
        } catch {
          // §6.6 — a throwing intro must never hide the story or hold scroll
          releaseIntro();
          finish();
        }
      });
    };

    // arm the hero-jack gesture path…
    window.addEventListener("wheel", onJackWheel, { passive: true });
    window.addEventListener("touchstart", onJackTouchStart, { passive: true });
    window.addEventListener("touchmove", onJackTouchMove, { passive: true });

    // …and the fallback path: if the jack window was skipped (you were already
    // past the hero, or the gate was still up during it), play the intro the
    // moment the section reaches the reading line. Same guards as before — a
    // deep scroll-restored load or a fling past skips straight to the story.
    cancelIO = onceInView(root, 70, () => {
      if (introStarted || cancelled) return;
      const r = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const scrolledIn = Math.abs(window.scrollY - mountScrollY) >= 4;
      if (!scrolledIn || r.top > vh * 0.7 + 2 || r.top <= -vh * 0.9) {
        finish();
        return;
      }
      beginIntro();
    });

    return () => {
      cancelled = true;
      cancelIO();
      removeHeroJack();
      for (const t of timers) clearTimeout(t);
      for (const a of anims) a.cancel();
      releaseIntro();
      for (const sp of splits) sp.revert();
      // restore every park so a remount starts from clean CSS
      for (const s of spans) {
        s.style.opacity = "";
        s.style.visibility = "";
      }
      for (const c of curtains) c.style.transform = ""; // panels back down
      maskEl.style.width = "";
      maskEl.style.visibility = "";
      if (photoSmiling) photoSmiling.style.opacity = "";
      media?.style.removeProperty("transform");
      introBoostRef.current = false;
      introParkRef.current = false;
      barsHeldRef.current = false;
      finish();
    };
    // isPhone is fixed per instance (posture change remounts) — see E1
  }, [isPhone]);

  const slides = isPhone
    ? mode === "product"
      ? PRODUCT_STEPS_M
      : IDEA_STEPS_M
    : mode === "product"
      ? PRODUCT_STEPS
      : IDEA_STEPS;
  // odometer/tick labels track the actual beat count (4 on phone, 5 on desktop)
  const rollNums = slides.map((_, i) => String(i + 1).padStart(2, "0"));
  const total = String(slides.length).padStart(2, "0");
  const sectionClass = [
    styles.section,
    live ? styles.isLive : "",
    mode === "product" ? styles.productTheme : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section ref={rootRef} className={sectionClass} id="idea">
      <div className={styles.walk}>
        <div className={styles.mediaGroup} data-ev-mg>
          <div className={styles.walkMedia} data-ev-media aria-hidden="true">
            {slides.map((sl, i) => (
              <div
                key={rollNums[i]}
                className={styles.scene}
                data-ev-scene
                data-i={i}
              >
                <img
                  className={styles.sceneImg}
                  src={sl.img}
                  alt=""
                  width={906}
                  height={862}
                  decoding="async"
                  loading="lazy"
                />
              </div>
            ))}
            <div className={styles.peelMount} ref={peelMountRef} />
          </div>
          <div className={styles.mediaCap} data-ev-cap aria-hidden="true">
            <span className={styles.ticks}>
              {rollNums.map((n) => (
                <span key={n} className={styles.tick} data-ev-tick />
              ))}
            </span>
            <span className={styles.stepcount} data-ev-count>
              <span className={styles.rollBox}>
                <span className={styles.roll} data-ev-roll>
                  {rollNums.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </span>
              </span>
              <span>&nbsp;/ {total}</span>
            </span>
          </div>
        </div>

        <div className={styles.steps}>
          {slides.map((sl, i) => (
            <section key={rollNums[i]} className={styles.step} data-ev-step>
              {/* no "Evan…" kicker on either posture any more — the opening
                  statement introduces him and the headline stands alone (the
                  intro photo fades out with the statement instead of flying
                  into an avatar). */}
              <h3 className={styles.headline} aria-label={sl.title}>
                {sl.title.split(/\s+/).map((w, wi) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: word order is the identity
                  <Fragment key={wi}>
                    {wi > 0 ? " " : null}
                    <span className={styles.w} aria-hidden="true">
                      <span data-ev-word>{w}</span>
                    </span>
                  </Fragment>
                ))}
              </h3>
              <p className={styles.copyBody} data-ev-body>
                {/* every body is a plain string now (shared copy). Phone gets
                    the SAME masked word reveal as the headline; desktop
                    animates the body as one block. */}
                {isPhone && typeof sl.body === "string"
                  ? sl.body.split(/\s+/).map((w, wi) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: word order is the identity
                      <Fragment key={wi}>
                        {wi > 0 ? " " : null}
                        <span className={styles.w}>
                          <span data-ev-bodyword>{w}</span>
                        </span>
                      </Fragment>
                    ))
                  : sl.body}
              </p>
              {/* finale (BOTH postures): past the title, the live pledge
                  stack, then the campaign CTA — they reveal on an EXTRA
                  scroll rather than with the headline (onceInView in E1 sets
                  data-in; the magnet snaps onto the stack as its own beat). */}
              {i === slides.length - 1 && (
                <>
                  {/* three pledge notifications stacked on top of each other,
                      the back two fanned out; they bounce in one after another
                      (CSS pledgePop, keyed on paintStep's data-in). */}
                  <span
                    className={styles.pledgeStack}
                    data-ev-extra
                    data-pledge-stack
                    aria-hidden="true"
                  >
                    <img
                      className={styles.pledgeCard}
                      data-pledge="2"
                      src="/assets/pledge.webp"
                      alt=""
                      width={316}
                      height={143}
                      decoding="async"
                      loading="lazy"
                    />
                    <img
                      className={styles.pledgeCard}
                      data-pledge="1"
                      src="/assets/pledge.webp"
                      alt=""
                      width={316}
                      height={143}
                      decoding="async"
                      loading="lazy"
                    />
                    <img
                      className={styles.pledgeCard}
                      data-pledge="0"
                      src="/assets/pledge.webp"
                      alt=""
                      width={316}
                      height={143}
                      decoding="async"
                      loading="lazy"
                    />
                  </span>
                  <a
                    href={siteConfig.founderUrl}
                    className={styles.cta}
                    data-ev-extra
                    data-hover="primary"
                  >
                    Start campaign
                  </a>
                </>
              )}
            </section>
          ))}
        </div>
      </div>

      {/* opening statement — overlays the story's first viewport and plays
          once on scroll-in, then hands off. The white surface is FIVE curtain
          panels that lift in a stagger at the handoff ("Curtains: Stagger"),
          unveiling the dark story beneath; the h2 floats above them. */}
      <div className={styles.statementWrap} data-ev-statement>
        <div className={styles.curtains} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={styles.curtain} data-ev-curtain />
          ))}
        </div>
        <h2 className={styles.statement}>
          <span data-ev-sword>This</span>
          <span className={styles.photoMask} data-ev-photomask>
            <img
              className={styles.photo}
              src="/assets/Evan_main.webp"
              alt="Evan"
              width={1063}
              height={1153}
              decoding="async"
              data-ev-photo
            />
            {/* The smiling frame, stacked on top and pre-decoded. The swap at
                the end of the statement toggles its opacity 0→1 instead of
                re-setting the first image's src — swapping src on a live <img>
                flashes while the browser decodes/repaints, even when cached.
                Both are always in the DOM, so this cut is instant. */}
            <img
              className={`${styles.photo} ${styles.photoSmiling}`}
              src={SMILING}
              alt=""
              aria-hidden="true"
              width={1063}
              height={1153}
              decoding="async"
              data-ev-photo-smiling
            />
          </span>
          <span data-ev-sword>is Evan…</span>
        </h2>
      </div>
    </section>
  );
}

// Posture gate. The phone story (≤700px) is a different SHAPE from the desktop
// one — word-masked plain bodies, extra finale nodes (pledge stack + CTA) —
// so it can't be a CSS restyle of one tree. SSR and the first client render
// are always "desktop"
// (matchMedia is unavailable on the server), so hydration matches; the effect
// then flips to "phone" on a phone. The `key` makes that flip REMOUNT the
// story rather than mutate it in place: the section's self-contained scroll
// engine re-binds to the fresh (4-step) DOM through its normal mount, so its
// load-bearing effects keep their exact lifecycle instead of re-running
// against a changed node count. A resize across 700px just remounts again —
// cheap, and rare on a phone.
export function EvanSection() {
  const [posture, setPosture] = useState<"desktop" | "phone">("desktop");
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const sync = () => setPosture(mq.matches ? "phone" : "desktop");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return <EvanStory key={posture} posture={posture} />;
}
