// lib/motion.ts — the site's motion kit. GSAP was removed by request; these
// helpers reproduce the section recipes on native primitives: the Web
// Animations API for tweens, IntersectionObserver for one-shot reveals, and
// hand-rolled word masks in place of SplitText.

export const EASE = {
  out1: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  out2: "cubic-bezier(0.215, 0.61, 0.355, 1)",
  out3: "cubic-bezier(0.165, 0.84, 0.44, 1)",
  out4: "cubic-bezier(0.23, 1, 0.32, 1)",
  in2: "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
  inOut2: "cubic-bezier(0.645, 0.045, 0.355, 1)",
  inOut3: "cubic-bezier(0.77, 0, 0.175, 1)",
  backOut17: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  backOut2: "cubic-bezier(0.34, 1.7, 0.64, 1)",
  backOut3: "cubic-bezier(0.34, 2.2, 0.64, 1)",
  backOut4: "cubic-bezier(0.34, 2.6, 0.64, 1)",
} as const;

export const easeFn = {
  out2: (t: number) => 1 - (1 - t) ** 3,
  out3: (t: number) => 1 - (1 - t) ** 4,
  inOut2: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
} as const;

type TweenVars = {
  duration: number;
  delay?: number;
  ease?: string;
};

const toMs = (vars: TweenVars): KeyframeAnimationOptions => ({
  duration: vars.duration * 1000,
  delay: (vars.delay ?? 0) * 1000,
  easing: vars.ease ?? "ease",
  fill: "backwards",
});

const styleKeys = (frame: Keyframe): string[] =>
  Object.keys(frame).filter(
    (key) => key !== "offset" && key !== "easing" && key !== "composite",
  );

const cssName = (property: string) =>
  property.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);

export function playFrom(
  element: HTMLElement,
  from: Keyframe,
  vars: TweenVars,
): Animation {
  for (const key of styleKeys(from)) {
    element.style.removeProperty(cssName(key));
  }
  element.style.removeProperty("visibility");
  return element.animate([{ ...from, offset: 0 }], toMs(vars));
}

export function playTo(
  element: HTMLElement,
  to: Keyframe,
  vars: TweenVars,
): Animation {
  const keys = styleKeys(to);
  const running = element.getAnimations();

  if (running.length) {
    const computed = getComputedStyle(element);
    for (const key of keys) {
      const property = cssName(key);
      element.style.setProperty(property, computed.getPropertyValue(property));
    }
    for (const animation of running) animation.cancel();
  }

  const animation = element.animate([{ ...to, offset: 1 }], toMs(vars));
  animation.finished
    .then(() => {
      for (const key of keys) {
        const value = to[key as keyof Keyframe];
        element.style.setProperty(cssName(key), String(value));
      }
      animation.cancel();
    })
    .catch(() => {
      // A following tween owns the frozen intermediate state.
    });

  return animation;
}

export function park(element: HTMLElement, frame: Keyframe): void {
  for (const key of styleKeys(frame)) {
    element.style.setProperty(
      cssName(key),
      String(frame[key as keyof Keyframe]),
    );
  }
  if ("opacity" in frame && String(frame.opacity) === "0") {
    element.style.visibility = "hidden";
  }
}

export type WordSplit = {
  words: HTMLElement[];
  revert: () => void;
};

export function splitWords(element: HTMLElement): WordSplit {
  const text = element.textContent ?? "";
  const previousLabel = element.getAttribute("aria-label");
  element.setAttribute("aria-label", text.trim());

  const fragment = document.createDocumentFragment();
  const words: HTMLElement[] = [];

  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      fragment.appendChild(document.createTextNode(" "));
      continue;
    }

    const mask = document.createElement("span");
    mask.setAttribute("aria-hidden", "true");
    mask.style.cssText =
      "display:inline-block;overflow:hidden;vertical-align:top;" +
      "padding-bottom:0.18em;margin-bottom:-0.18em";

    const word = document.createElement("span");
    word.style.display = "inline-block";
    word.textContent = part;
    mask.appendChild(word);
    fragment.appendChild(mask);
    words.push(word);
  }

  element.replaceChildren(fragment);

  return {
    words,
    revert: () => {
      element.replaceChildren(document.createTextNode(text));
      if (previousLabel === null) element.removeAttribute("aria-label");
      else element.setAttribute("aria-label", previousLabel);
    },
  };
}

/**
 * Legacy section-arrival compatibility wrapper.
 *
 * This function intentionally does not hold or move scrolling anymore. The
 * old implementation pinned the body and animated body.style.top, causing
 * trackpad momentum to be swallowed and mobile visual/layout viewports to
 * disagree. Existing sections can keep their reveal choreography while the
 * browser remains the sole owner of page position.
 *
 * `ms` and `target` stay in the signature so callers can migrate separately.
 * The cue runs on the next microtask and the returned function can cancel it.
 */
export function holdScroll(
  _ms: number,
  _target: HTMLElement,
  onSettled?: () => void,
): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) onSettled?.();
  });
  return () => {
    cancelled = true;
  };
}

/** Retained for callers that used the old pinned-scroll coordination API. */
export const hasLiveHold = (): boolean => false;

/** Retained for navbar compatibility; native scroll events now cover updates. */
export const VSCROLL_EVENT = "proovd:vscroll";

export function onceInView(
  element: Element,
  viewportPct: number,
  callback: () => void,
): () => void {
  if (
    element.getBoundingClientRect().top <=
    (window.innerHeight * viewportPct) / 100
  ) {
    callback();
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.disconnect();
        callback();
        return;
      }
    },
    { rootMargin: `0px 0px ${viewportPct - 100}% 0px` },
  );

  observer.observe(element);
  return () => observer.disconnect();
}
