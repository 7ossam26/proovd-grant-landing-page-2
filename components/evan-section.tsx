"use client";

import type { ReactNode } from "react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WordSplit } from "@/lib/motion";
import {
  EASE,
  easeFn,
  onceInView,
  park,
  playFrom,
  playTo,
  splitWords,
} from "@/lib/motion";
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

const AVATAR = "/assets/Evan_main_smiling.webp";

const IDEA_STEPS: EvanStep[] = [
  {
    img: "/assets/Evan_Idea.webp",
    alt: "Evan surrounded by sticky notes, thinking",
    title: "has an Idea",
    body: (
      <>
        It lives in a half-finished Notion doc and{" "}
        <mark>a 2 am voice memo</mark>. One question he can’t shake: would
        anyone actually pay for it?
      </>
    ),
  },
  {
    img: "/assets/saying_his_idea_evan.webp",
    alt: "Evan saying his idea out loud",
    title: "speaks it out loud",
    body: (
      <>
        He tells Proovd the problem and his fix. As if he’s{" "}
        <mark>talking to a friend</mark>, Proovd turns it from a messy train of
        thought into a campaign page people can back.
      </>
    ),
  },
  {
    img: "/assets/Campaign_Evan.webp",
    alt: "Evan matched with a creator",
    title: "gets matched",
    body: (
      <>
        Proovd pairs him with a vetted YouTuber: <mark>80K subs</mark>, exactly
        his niche. Getting strangers to care just became someone else’s job.
      </>
    ),
  },
  {
    img: "/assets/Live_Evan.webp",
    alt: "The campaign going live",
    title: "Campaign goes live",
    body: (
      <>
        The creator hits post and <mark>80,000 people</mark> see it while it’s
        still just an idea. The ones who want it reserve theirs. Their card gets
        saved, not charged yet.
      </>
    ),
  },
  {
    img: "/assets/Money_Evan.webp",
    alt: "The campaign making money",
    title: "has users",
    body: (
      <>
        The campaign hits its pre-order goal. Saved cards get charged, and Evan
        starts building with <mark>money in the bank</mark> and his first
        customers waiting.
      </>
    ),
  },
];

// product mode: the same journey, told about the app he already built
const PRODUCT_STEPS: EvanStep[] = [
  {
    img: "/assets/Product_Evan.webp",
    alt: "Evan with the app he built",
    title: "has an app built",
    body: (
      <>
        A study planner, built instead of studying for finals, live on
        TestFlight with 12 users, all of them friends. The app works and{" "}
        <mark>nobody knows it exists</mark>.
      </>
    ),
  },
  {
    img: "/assets/saying_his_idea_evan.webp",
    alt: "Evan showing what his app does",
    title: "tells us what his app does",
    body: (
      <>
        He tells Proovd about the app, as if he’s{" "}
        <mark>talking to a friend</mark>. We turn it from a messy explanation
        into a campaign page people can back.
      </>
    ),
  },
  {
    img: "/assets/Campaign_Evan.webp",
    alt: "Evan matched with a creator",
    title: "gets matched",
    body: (
      <>
        Proovd pairs him with a vetted YouTuber: <mark>80K subs</mark>, exactly
        his niche. Reaching past his friend group just became someone else’s
        job.
      </>
    ),
  },
  {
    img: "/assets/Live_Evan.webp",
    alt: "The campaign going live",
    title: "Campaign goes live",
    body: (
      <>
        The creator hits post, and <mark>80,000 people</mark> meet the app
        today. The ones who want in reserve a founding-member spot. Their card
        is saved, not charged yet.
      </>
    ),
  },
  {
    img: "/assets/Money_Evan.webp",
    alt: "The campaign making money",
    title: "has users",
    body: (
      <>
        When the campaign closes, the saved cards get charged and he{" "}
        <mark>keeps whatever came in</mark>. His app finally has users he can
        keep building for.
      </>
    ),
  },
];

const STEP_COUNT = 5;
const ROLL_NUMBERS = ["01", "02", "03", "04", "05"];

// ── shared math + painters (pure — no window access at module scope) ─────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeBack = (x: number) => {
  const c = 1.8;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};
const easePop = (x: number) => {
  const c = 3.0;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

type StepRec = {
  el: HTMLElement;
  kicker: HTMLElement | null;
  avatar: HTMLElement | null;
  body: HTMLElement | null;
  words: HTMLElement[];
  lines: number[]; // visual line index per word — lines rise as one unit
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
  // hero: lines swing up and lean into place
  r.words.forEach((w, i) => {
    const e = easeBack(clamp01((a - 0.06 - (r.lines[i] || 0) * 0.16) / 0.5));
    w.style.transform = `translateY(${((1 - e) * 130).toFixed(2)}%) rotate(${((1 - e) * -7).toFixed(2)}deg)`;
  });
  // kicker: avatar pops on like a slapped sticker
  if (r.kicker) {
    const e = easeOut(clamp01(a / 0.28));
    r.kicker.style.transform = `translateY(${((1 - e) * 16).toFixed(2)}px)`;
    r.kicker.style.opacity = e.toFixed(3);
  }
  if (r.avatar) {
    const pe = easePop(clamp01((a - 0.04) / 0.3));
    r.avatar.style.transform = `scale(${(0.2 + 0.8 * pe).toFixed(3)})`;
  }
  // body: trails in, whisper-quiet
  if (r.body) {
    const e = easeOut(clamp01((a - 0.42) / 0.38));
    r.body.style.transform = `translateY(${((1 - e) * 26).toFixed(2)}px)`;
    r.body.style.opacity = e.toFixed(3);
  }
  // payoff: highlight sweeps only after the words land — marker overshoot
  r.el.style.setProperty(
    "--mk",
    easeBack(clamp01((a - 0.78) / 0.22)).toFixed(4),
  );
  // exit: the whole step rides up and dims as the next one takes over
  r.el.style.transform = `translateY(${(-30 * easeOut(lv)).toFixed(2)}px)`;
  r.el.style.opacity = (1 - 0.6 * easeOut(lv)).toFixed(3);
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

export function EvanSection() {
  const [mode, setMode] = useState<Mode>("idea");
  const [live, setLive] = useState(false); // JS engine running (port of html.js)
  const rootRef = useRef<HTMLElement>(null);
  const peelMountRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>(mode);
  const gRef = useRef(0); // continuous story position, 0..4
  const peelRef = useRef<PeelApi | null>(null);
  const introBusyRef = useRef(false); // statement playing — magnet stands down
  const introBoostRef = useRef(false); // just handed off — step 1 assembles
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

    const recs: StepRec[] = stepEls.map((el) => ({
      el,
      kicker: el.querySelector<HTMLElement>("[data-ev-kicker]"),
      avatar: el.querySelector<HTMLElement>("[data-ev-avatar]"),
      body: el.querySelector<HTMLElement>("[data-ev-body]"),
      words: [],
      lines: [],
      target: 0,
      lvT: 0,
      sp: 0,
      lv: 0,
      done: false,
    }));
    stepsRef.current = recs;
    setLive(true);

    const mqM = window.matchMedia("(max-width: 900px)");
    // the repo navbar is FIXED and overlays content — measure the real thing
    const navEl = document.querySelector<HTMLElement>('nav[aria-label="Main"]');
    const firstImage = () =>
      root.querySelector<HTMLImageElement>("[data-ev-scene] img");

    const readLineY = () => {
      const H = window.innerHeight;
      if (mqM.matches && mgEl) {
        const mb = Math.max(56, mgEl.getBoundingClientRect().bottom);
        return mb + Math.max(Math.min(170, (H - mb) * 0.5), (H - mb) * 0.34);
      }
      return H * 0.5;
    };

    // the panel follows the photos' native ratio; the sticky offsets follow
    // the measured nav so the media clears the fixed bar on both layouts
    const layout = () => {
      const mob = mqM.matches;
      const img = firstImage();
      const iw = img?.naturalWidth || 717;
      const ih = img?.naturalHeight || 533;
      const boxR = mob ? 1.2 : iw / ih;
      mediaEl.style.aspectRatio = String(boxR);
      mediaEl.style.width = mob
        ? `min(100%, calc(50vh * ${boxR.toFixed(4)}))`
        : `min(100%, calc(70vh * ${boxR.toFixed(4)}))`;
      const navH = navEl?.offsetHeight ?? 0;
      mgEl.style.top = mob
        ? navEl
          ? `${navH}px`
          : ""
        : `${Math.max(navH + 12, (window.innerHeight - mgEl.offsetHeight) / 2)}px`;
      if (capEl) {
        capEl.style.width = mob
          ? `${mediaEl.getBoundingClientRect().width}px`
          : "";
        capEl.style.marginLeft = mob ? "auto" : "";
        capEl.style.marginRight = mob ? "auto" : "";
      }
    };
    layoutRef.current = layout;

    const update = () => {
      const H = window.innerHeight;
      const centres = recs.map((r) => {
        const rect = r.el.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });

      const READ = readLineY();
      const mob = mqM.matches;
      const mb =
        mob && mgEl ? Math.max(56, mgEl.getBoundingClientRect().bottom) : 0;
      const START = H * (mob ? 1.05 : 1.08);
      const END = mob ? READ + (H - mb) * 0.16 : H * 0.68;
      const zone = mob ? Math.max(120, (H - mb) * 0.55) : H * 0.42;
      recs.forEach((r, i) => {
        r.target = reduced ? 1 : clamp01((START - centres[i]) / (START - END));
        // leaving: how far past the reading line this step has travelled
        r.lvT = reduced ? 0 : clamp01((READ - centres[i]) / zone);
      });

      // intro handoff choreography: while the opening statement plays, step
      // one waits fully disassembled beneath the opaque overlay; the moment
      // the statement hands off it's floored to fully-assembled instead, so
      // the chase loop plays the text in. The floor retires on the first
      // real user input — natural scroll targets take over from there.
      if (!reduced && recs[0]) {
        if (introBusyRef.current) {
          recs[0].target = 0;
          recs[0].lvT = 0;
        } else if (introBoostRef.current) {
          recs[0].target = 1;
          recs[0].lvT = 0;
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
        scenes.forEach((sc, i) => {
          const v = clamp01((1 - Math.abs(g - i) - 0.28) / 0.44);
          sc.style.setProperty("--v", v.toFixed(3));
          sc.style.opacity = v.toFixed(3);
        });
      }
      peelRef.current?.setProgress(g);
      gRef.current = g;
      if (reduced) {
        // static progress paint (the chase loop is off)
        for (const [i, t] of ticks.entries()) {
          t.style.setProperty("--tf", clamp01(g - i + 1).toFixed(3));
        }
        rollEl.style.transform = `translateY(${(-g * 1.1).toFixed(2)}em)`;
      }
    };
    updateRef.current = update;

    // ── whisper magnet: acts only after you've fully stopped, only while
    // the story spans the reading line, and yields to ANY movement — it can
    // never stop you. The one place in the codebase allowed to write scroll.
    let magnetTimer = 0;
    let nudgeRAF = 0;
    let nudging = false;
    let nudgeY = 0;
    let lastActivity = performance.now();
    const killNudge = () => {
      if (nudgeRAF) cancelAnimationFrame(nudgeRAF);
      nudgeRAF = 0;
      nudging = false;
    };
    const armMagnet = () => {
      clearTimeout(magnetTimer);
      magnetTimer = window.setTimeout(nudge, 400);
    };
    const engaged = () => {
      const r = root.getBoundingClientRect();
      const READ = readLineY();
      return r.top < READ && r.bottom > READ;
    };
    const nudge = () => {
      if (reduced || nudging || introBusyRef.current) return;
      // parked in another section — the magnet must never drag users into
      // the story from the hero or the FAQ
      if (!engaged()) return;
      const H = window.innerHeight;
      let best = Number.POSITIVE_INFINITY;
      for (const r of recs) {
        const rect = r.el.getBoundingClientRect();
        const d = rect.top + rect.height / 2 - readLineY();
        if (Math.abs(d) < Math.abs(best)) best = d;
      }
      if (!Number.isFinite(best) || Math.abs(best) < 3) return;
      // two tempos: near = quick tidy; far (mid-gap limbo) = patient rescue
      // only after true stillness — never during reading pauses
      const near = Math.abs(best) <= H * 0.15;
      const need = near ? 400 : 2000;
      const still = performance.now() - lastActivity;
      if (still < need) {
        magnetTimer = window.setTimeout(nudge, need - still + 10);
        return;
      }
      const span =
        (recs[1]
          ? Math.abs(
              recs[1].el.getBoundingClientRect().top -
                recs[0].el.getBoundingClientRect().top,
            )
          : H) / 2;
      const y0 = window.scrollY;
      const t0 = performance.now();
      const D = 300 + 550 * Math.min(1, Math.abs(best) / Math.max(span, 1));
      const ease = (t: number) => 1 - (1 - t) ** 3;
      nudging = true;
      nudgeY = y0;
      const stepFrame = (now: number) => {
        if (!nudging) return;
        // an external scroll (scrollbar drag, programmatic) wins instantly
        if (Math.abs(window.scrollY - nudgeY) > 1.5) {
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
    const onInput = () => {
      introBoostRef.current = false; // the user moved — natural targets win
      lastActivity = performance.now();
      killNudge();
      armMagnet();
    };
    const INPUT_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"];
    for (const ev of INPUT_EVENTS) {
      window.addEventListener(ev, onInput, { passive: true });
    }

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
        // any scroll we didn't cause = the user moving — back off instantly
        if (nudging && Math.abs(window.scrollY - nudgeY) > 1.5) killNudge();
        if (!nudging) {
          lastActivity = performance.now();
          armMagnet();
        }
      });
    };

    const measureAll = () => {
      for (const r of recs) measureLines(r);
    };
    const onResize = () => {
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

    // warm the other story's images so the first toggle never waits
    for (const s of PRODUCT_STEPS) {
      new Image().src = s.img;
    }

    layout();
    update();
    firstImage()
      ?.decode?.()
      .then(() => {
        if (alive) {
          layout();
          update();
        }
      })
      .catch(() => {});

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
      const gT = gRef.current;
      if (Math.abs(gT - gs) > 0.0004) {
        gs += (gT - gs) * k;
        if (Math.abs(gT - gs) < 0.0004) gs = gT;
        const fl = Math.floor(gs);
        const fr = gs - fl;
        rollEl.style.transform = `translateY(${(-(fl + easeBack(clamp01((fr - 0.3) / 0.4))) * 1.1).toFixed(3)}em)`;
        ticks.forEach((t, i) => {
          const tf = clamp01(gs - i + 1);
          t.style.setProperty("--tf", tf.toFixed(3));
          const b = Math.sin(Math.PI * clamp01((tf - 0.8) / 0.2)); // the thump
          t.style.transform = `scale(${(1 + 0.32 * b).toFixed(3)}) rotate(${(b * 5).toFixed(2)}deg)`;
        });
      }
      for (const r of recs) {
        if (
          Math.abs(r.target - r.sp) < 0.0006 &&
          Math.abs(r.lvT - r.lv) < 0.0006 &&
          r.done
        ) {
          continue;
        }
        r.sp += (r.target - r.sp) * k;
        r.lv += (r.lvT - r.lv) * k;
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
      for (const ev of INPUT_EVENTS) window.removeEventListener(ev, onInput);
      clearTimeout(magnetTimer);
      killNudge();
      updateRef.current = () => {};
      layoutRef.current = () => {};
      stepsRef.current = [];
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

    const IDEA_SRCS = IDEA_STEPS.map((s) => s.img);
    const PRODUCT_SRCS = PRODUCT_STEPS.map((s) => s.img);
    const UNIQUE = Array.from(new Set([...IDEA_SRCS, ...PRODUCT_SRCS]));

    let alive = true;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let disposeFns: Array<() => void> = [];

    (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
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
        return;
      }
      if (!alive) return;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
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
      const SEG = 160;
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
      // each page peels from its own corner so the story doesn't repeat
      const PEELS = [
        { ox: 87.96, oy: 83.55, ang: 145.81 }, // bottom-right, rolls up-left
        { ox: 12.04, oy: 83.55, ang: 34.19 }, // bottom-left, rolls up-right
        { ox: 50, oy: 16.45, ang: 270 }, // top edge, rolls straight down
        { ox: 87.96, oy: 83.55, ang: 145.81 }, // bottom-right, rolls up-left
      ];

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
        m.position.z = (STEP_COUNT - 1 - i) * 0.004;
        m.renderOrder = STEP_COUNT - i;
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
      const resize = () => {
        if (!renderer) return;
        const dpr = Math.min((window.devicePixelRatio || 1) * 1.25, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(mount.clientWidth, mount.clientHeight, false);
        build();
        needsRender = true;
      };
      mount.appendChild(renderer.domElement);
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
        if (!mount.clientWidth) return; // hidden
        const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
        let moving = false;
        // intro entrance: the first sheet is driven by the clock, easing
        // from fully rolled off its corner back down flat — the peel played
        // in reverse. The scroll chase takes back over once it lands.
        const entering = introT0 > 0;
        if (entering) {
          const p = Math.min(1, (now - introT0) / 900);
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
          // while the entrance rolls, the arriving sheet stays opaque and
          // nothing beneath it may show early
          L.u.uFade.value = entering
            ? i === 0
              ? 1
              : 0
            : clamp((100 - L.cur) / 8, 0, 1);
        });
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
    })();

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
  }, []);

  // E4 — the opening statement: "This is Evan…" plays once as the story
  // first scrolls in (word masks, the photo window expanding, the smiling
  // swap), then hands off — the photo flies into step 1's kicker avatar.
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
    const avatar = root.querySelector<HTMLElement>(
      "[data-ev-step] [data-ev-avatar]",
    );
    const media = root.querySelector<HTMLElement>("[data-ev-mg]");
    const ticksEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ev-tick]"),
    );
    const countEl = root.querySelector<HTMLElement>("[data-ev-count]");
    const dockEl = root.querySelector<HTMLElement>("[data-ev-dock]");
    if (!wrap || spans.length < 2 || !maskEl || !photo) return;

    // StrictMode/remount: undo whatever a previous run left behind
    wrap.style.display = "";
    if (avatar) avatar.style.visibility = "";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wrap.style.display = "none"; // land directly on the story
      return;
    }

    let cancelled = false;
    const timers: number[] = [];
    const anims: Animation[] = [];
    let splits: WordSplit[] = [];
    let flightRAF = 0;
    let flight: HTMLElement | null = null;

    const killFlight = () => {
      if (flightRAF) cancelAnimationFrame(flightRAF);
      flightRAF = 0;
      flight?.remove();
      flight = null;
    };
    const finish = () => {
      // fail-open: the story must never stay trapped behind the overlay,
      // and no sequenced element may stay parked hidden
      wrap.style.display = "none";
      if (avatar) avatar.style.visibility = "";
      for (const el of [countEl, dockEl, ...ticksEls]) {
        el?.style.removeProperty("opacity");
        el?.style.removeProperty("visibility");
      }
      media?.style.removeProperty("opacity");
      media?.style.removeProperty("transform");
    };

    // ── the intro scroll hold: wheel/touch are swallowed while the
    // statement plays and released the instant the story takes over
    const holdWheel = (e: Event) => e.preventDefault();
    const holdTouch = (e: Event) => e.preventDefault();
    let holding = false;
    let glideRAF = 0;
    const holdInput = () => {
      if (holding) return;
      holding = true;
      introBusyRef.current = true; // the whisper magnet stands down
      window.addEventListener("wheel", holdWheel, { passive: false });
      window.addEventListener("touchmove", holdTouch, { passive: false });
    };
    // releaseHold frees the scroll only; releaseIntro is the full fail-open
    // (the handoff frees scroll at the cut but keeps step one parked via
    // introBusyRef for a beat, so the text can enter on its own cue)
    const releaseHold = () => {
      if (glideRAF) cancelAnimationFrame(glideRAF);
      glideRAF = 0;
      if (!holding) return;
      holding = false;
      window.removeEventListener("wheel", holdWheel);
      window.removeEventListener("touchmove", holdTouch);
    };
    const releaseIntro = () => {
      releaseHold();
      introBusyRef.current = false;
    };
    // the old glide-in: while input is held the page settles onto the
    // section top, so the statement plays parked instead of mid-boundary
    const settleToTop = () => {
      const y0 = window.scrollY;
      const target = y0 + root.getBoundingClientRect().top;
      if (Math.abs(target - y0) < 2) return;
      const t0 = performance.now();
      const D = 400;
      const glide = (now: number) => {
        if (!holding) return;
        const t = Math.min(1, (now - t0) / D);
        window.scrollTo(0, y0 + (target - y0) * easeFn.inOut2(t));
        if (t < 1) glideRAF = requestAnimationFrame(glide);
      };
      glideRAF = requestAnimationFrame(glide);
    };

    // park before the trigger: words hidden, the photo window shut.
    // (The mask's natural width is measured later, at reveal time — right
    // now the wrap is still display:none, since .isLive only lands after
    // this effect pass, and a display:none box measures 0px.)
    maskEl.style.visibility = "";
    photo.setAttribute("src", "/assets/Evan_main.webp");
    for (const s of spans) park(s, { opacity: 0 });
    maskEl.style.width = "0px";

    // preload the smiling frame so the end-of-statement cut is instant
    const smiling = new Image();
    smiling.src = AVATAR;

    // the old Flip-to-thumb, rebuilt as a chasing flight: the target rect is
    // re-measured every frame, so the avatar scrolling with the page never
    // makes the clone land wide
    const flyToAvatar = () => {
      if (!avatar) return;
      const from = maskEl.getBoundingClientRect();
      if (from.width < 1) return; // window never opened — nothing to fly
      killFlight();
      const clone = maskEl.cloneNode(true) as HTMLElement;
      flight = clone;
      clone.style.position = "fixed";
      clone.style.top = `${from.top}px`;
      clone.style.left = `${from.left}px`;
      clone.style.width = `${from.width}px`;
      clone.style.height = `${from.height}px`;
      clone.style.margin = "0";
      clone.style.zIndex = "60";
      clone.style.visibility = "visible";
      document.body.appendChild(clone);
      maskEl.style.visibility = "hidden";
      avatar.style.visibility = "hidden"; // appears when the flight lands
      const t0 = performance.now();
      const D = 600; // the Flip's 0.6s power2.inOut
      const stepFrame = (now: number) => {
        const t = Math.min(1, (now - t0) / D);
        const e = easeFn.inOut2(t);
        const to = avatar.getBoundingClientRect();
        clone.style.top = `${from.top + (to.top - from.top) * e}px`;
        clone.style.left = `${from.left + (to.left - from.left) * e}px`;
        clone.style.width = `${from.width + (to.width - from.width) * e}px`;
        clone.style.height = `${from.height + (to.height - from.height) * e}px`;
        if (t < 1) {
          flightRAF = requestAnimationFrame(stepFrame);
        } else {
          avatar.style.visibility = "";
          killFlight();
        }
      };
      flightRAF = requestAnimationFrame(stepFrame);
    };

    const cancelIO = onceInView(root, 70, () => {
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]).then(() => {
        if (cancelled) return;
        try {
          // play only if the user is actually here to watch it. A fast
          // fling past, or a scroll-restored load deep in the page, must
          // neither be yanked back nor burn the once-only statement while
          // nobody is looking — skip straight to the story instead.
          const r = root.getBoundingClientRect();
          const vh = window.innerHeight;
          if (r.top > vh * 0.7 + 2 || r.top <= -vh * 0.5) {
            finish();
            return;
          }
          holdInput();
          settleToTop();
          // measure the photo window's natural width NOW — the wrap only
          // became visible when .isLive landed (after the effect pass), and
          // measuring a display:none box reads 0px, which kept the photo
          // from ever appearing
          maskEl.style.width = "";
          const maskWidth = maskEl.offsetWidth;
          maskEl.style.width = "0px";
          // park the sequenced arrivals while the overlay still covers
          // them — each element enters on its own cue after the handoff
          for (const el of [countEl, dockEl, ...ticksEls]) {
            if (el) park(el, { opacity: 0 });
          }
          // Act 1 — the statement
          splits = spans.map((s) => splitWords(s));
          const words = splits.flatMap((sp) => sp.words);
          for (const s of spans) {
            s.style.opacity = "";
            s.style.visibility = "";
          }
          words.forEach((w, i) => {
            anims.push(
              playFrom(
                w,
                { transform: "translateY(120%)" },
                { duration: 0.45, delay: i * 0.05, ease: EASE.out4 },
              ),
            );
          });
          const wordsEnd = 0.45 + (words.length - 1) * 0.05;
          const maskStart = Math.max(0, wordsEnd - 0.25);
          // the photo window expands while the photo settles from a zoom
          anims.push(
            playTo(
              maskEl,
              { width: `${maskWidth}px` },
              { duration: 0.5, delay: maskStart, ease: EASE.out3 },
            ),
          );
          anims.push(
            playFrom(
              photo,
              { transform: "scale(1.3)" },
              { duration: 0.5, delay: maskStart, ease: EASE.out3 },
            ),
          );
          const maskEnd = maskStart + 0.5;
          timers.push(
            window.setTimeout(
              () => photo.setAttribute("src", smiling.src),
              (maskEnd + 0.35) * 1000,
            ),
          );
          // Act 2 — the handoff: words fade up and out, the photo flies to
          // step 1's avatar, and the overlay cuts away to the live story
          const exitAt = maskEnd + 0.35 + 0.5;
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
              flyToAvatar();
            }, exitAt * 1000),
          );
          // ── the handoff sequence: overlay cuts → the stamp reverse-peels
          // onto the page in place → text assembles → ticks pop one by one
          // → the counter → the mode dock. Each on its own cue.
          timers.push(
            window.setTimeout(
              () => {
                wrap.style.display = "none";
                releaseHold(); // scrolling is free from the cut onward
                if (peelRef.current?.active) {
                  peelRef.current.entrance();
                } else if (media) {
                  // no WebGL: the crossfade panel presses in like a sticker
                  anims.push(
                    playFrom(
                      media,
                      { opacity: 0, transform: "scale(0.94)" },
                      { duration: 0.5, ease: EASE.out3 },
                    ),
                  );
                }
              },
              (exitAt + 0.1) * 1000,
            ),
          );
          timers.push(
            window.setTimeout(
              () => {
                // step one assembles: the engine floors its target to 1 and
                // its own chase raises kicker → headline lines → body
                introBusyRef.current = false;
                introBoostRef.current = true;
                updateRef.current();
              },
              (exitAt + 0.45) * 1000,
            ),
          );
          timers.push(
            window.setTimeout(
              () => {
                ticksEls.forEach((t, i) => {
                  anims.push(
                    playFrom(
                      t,
                      { opacity: 0, transform: "translateY(10px) scale(0.4)" },
                      { duration: 0.4, delay: i * 0.07, ease: EASE.backOut2 },
                    ),
                  );
                });
              },
              (exitAt + 0.75) * 1000,
            ),
          );
          timers.push(
            window.setTimeout(
              () => {
                if (countEl) {
                  anims.push(
                    playFrom(
                      countEl,
                      { opacity: 0, transform: "translateY(12px)" },
                      { duration: 0.4, ease: EASE.out3 },
                    ),
                  );
                }
              },
              (exitAt + 1.05) * 1000,
            ),
          );
          timers.push(
            window.setTimeout(
              () => {
                if (dockEl) {
                  anims.push(
                    playFrom(
                      dockEl,
                      { opacity: 0, transform: "translateY(18px)" },
                      { duration: 0.45, ease: EASE.backOut17 },
                    ),
                  );
                }
              },
              (exitAt + 1.25) * 1000,
            ),
          );
        } catch {
          // §6.6 — a throwing intro must never hide the story or hold scroll
          releaseIntro();
          finish();
        }
      });
    });

    return () => {
      cancelled = true;
      cancelIO();
      for (const t of timers) clearTimeout(t);
      for (const a of anims) a.cancel();
      killFlight();
      releaseIntro();
      for (const sp of splits) sp.revert();
      // restore every park so a remount starts from clean CSS
      for (const s of spans) {
        s.style.opacity = "";
        s.style.visibility = "";
      }
      maskEl.style.width = "";
      maskEl.style.visibility = "";
      media?.style.removeProperty("transform");
      introBoostRef.current = false;
      finish();
    };
  }, []);

  const slides = mode === "product" ? PRODUCT_STEPS : IDEA_STEPS;
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
            <div className={styles.stampBg} />
            {slides.map((sl, i) => (
              <div
                key={ROLL_NUMBERS[i]}
                className={styles.scene}
                data-ev-scene
                data-i={i}
              >
                <img
                  className={styles.sceneImg}
                  src={sl.img}
                  alt=""
                  width={906}
                  height={696}
                  decoding="async"
                  loading="lazy"
                />
              </div>
            ))}
            <div className={styles.peelMount} ref={peelMountRef} />
          </div>
          <div className={styles.mediaCap} data-ev-cap aria-hidden="true">
            <span className={styles.ticks}>
              {ROLL_NUMBERS.map((n) => (
                <span key={n} className={styles.tick} data-ev-tick />
              ))}
            </span>
            <span className={styles.stepcount} data-ev-count>
              <span className={styles.rollBox}>
                <span className={styles.roll} data-ev-roll>
                  {ROLL_NUMBERS.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </span>
              </span>
              <span>&nbsp;/ 05</span>
            </span>
          </div>
        </div>

        <div className={styles.steps}>
          {slides.map((sl, i) => (
            <section key={ROLL_NUMBERS[i]} className={styles.step} data-ev-step>
              <div className={styles.kicker} data-ev-kicker>
                <span className={styles.avatar} data-ev-avatar>
                  <img
                    src={AVATAR}
                    alt=""
                    width={1063}
                    height={1153}
                    decoding="async"
                    loading="lazy"
                  />
                </span>
                <span className={styles.kickerLabel}>
                  {i === 3 ? "Evan's…" : "Evan…"}
                </span>
              </div>
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
                {sl.body}
              </p>
            </section>
          ))}
        </div>
      </div>

      {/* story mode toggle — sticky to the viewport bottom, but clamped
          inside this section so it only exists while the story is on screen */}
      <div className={styles.modeDock} data-ev-dock>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset can't
            reliably host the mobile switch's grid track + sliding thumb */}
        <div
          className={`${styles.mode} ${mode === "product" ? styles.productOn : ""}`}
          role="group"
          aria-label="Where are you at?"
        >
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === "idea" ? styles.isOn : ""}`}
            aria-pressed={mode === "idea"}
            onClick={() => setMode("idea")}
          >
            I have an Idea
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === "product" ? styles.isOn : ""}`}
            aria-pressed={mode === "product"}
            onClick={() => setMode("product")}
          >
            I have a product
          </button>
        </div>
      </div>

      {/* opening statement — overlays the story's first viewport and plays
          once on scroll-in, then hands off. Scrolling is never blocked. */}
      <div className={styles.statementWrap} data-ev-statement>
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
          </span>
          <span data-ev-sword>is Evan…</span>
        </h2>
      </div>
    </section>
  );
}
