import { describe, expect, it } from "vitest";
import {
  activeSceneIndex,
  clamp01,
  curtainPanelProgress,
  rampBetween,
  sceneVisualAt,
  storyPositionAt,
  trackProgress,
} from "@/lib/scroll-story";

/**
 * The scroll story's arithmetic.
 *
 * These functions replaced a stateful engine, so the property that matters is
 * not "does it look right going forwards" — it is that the state is a pure
 * function of the scroll position with no memory at all. Every test below
 * exists to pin that: the same progress must produce the same frame no matter
 * what came before it.
 *
 * Hence NON_LINEAR: the sequence deliberately jumps forward, runs to the end,
 * and reverses in uneven steps. A smooth 0→1 sweep would pass even on an
 * engine that carried hidden state; this ordering is what catches one.
 */
const NON_LINEAR = [0, 0.24, 0.51, 0.78, 1, 0.62, 0.28, 0];

/** Matches SCENE_COUNT in components/evan-section.tsx: statement + 4 beats
 *  + finale. */
const SCENES = 6;

describe("trackProgress", () => {
  it("is 0 before the track starts and 1 once its travel is spent", () => {
    expect(trackProgress(0, 600, 100)).toBe(0);
    expect(trackProgress(-500, 600, 100)).toBe(1);
  });

  it("clamps outside the track instead of running away", () => {
    expect(trackProgress(400, 600, 100)).toBe(0); // still below the fold
    expect(trackProgress(-9999, 600, 100)).toBe(1); // long since scrolled past
  });

  it("is linear across the usable travel", () => {
    expect(trackProgress(-250, 600, 100)).toBeCloseTo(0.5, 5);
  });

  it("never divides by zero on an unlaid-out section", () => {
    // jsdom, and the first frame before paint, report every dimension as 0.
    expect(trackProgress(0, 0, 0)).toBe(0);
    expect(Number.isFinite(trackProgress(-10, 0, 0))).toBe(true);
  });

  it("swallows NaN rather than propagating it into the DOM", () => {
    // A NaN would reach the DOM as `opacity: NaN`, which the browser drops —
    // leaving a scene frozen at whatever it happened to be. Fail to 0.
    expect(trackProgress(Number.NaN, 600, 100)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(storyPositionAt(Number.NaN, SCENES)).toBe(0);
  });
});

describe("storyPositionAt", () => {
  it("spans 0 .. sceneCount-1", () => {
    expect(storyPositionAt(0, SCENES)).toBe(0);
    expect(storyPositionAt(1, SCENES)).toBe(SCENES - 1);
    expect(storyPositionAt(0.5, SCENES)).toBeCloseTo(2.5, 5);
  });

  it("survives a degenerate scene count", () => {
    expect(storyPositionAt(0.7, 1)).toBe(0);
    expect(storyPositionAt(0.7, 0)).toBe(0);
  });
});

describe("activeSceneIndex", () => {
  it("marks the expected scene at known progress values", () => {
    const at = (p: number) =>
      activeSceneIndex(storyPositionAt(p, SCENES), SCENES);
    expect(at(0)).toBe(0); // the opening statement
    expect(at(0.2)).toBe(1); // first beat
    expect(at(0.4)).toBe(2);
    expect(at(0.6)).toBe(3);
    expect(at(0.8)).toBe(4);
    expect(at(1)).toBe(SCENES - 1); // the finale
  });

  it("stays in range for out-of-band positions", () => {
    expect(activeSceneIndex(-4, SCENES)).toBe(0);
    expect(activeSceneIndex(99, SCENES)).toBe(SCENES - 1);
  });

  it("flips at the midpoint, where the crossfade hands over", () => {
    // The active marker and the visually dominant scene must agree; both turn
    // over at .5, so neither can lead or lag the other.
    expect(activeSceneIndex(1.49, SCENES)).toBe(1);
    expect(activeSceneIndex(1.51, SCENES)).toBe(2);
  });

  it("names exactly one active scene at every point of a jumbled scroll", () => {
    for (const p of NON_LINEAR) {
      const position = storyPositionAt(p, SCENES);
      const active = activeSceneIndex(position, SCENES);
      const claimed = Array.from({ length: SCENES }, (_, i) => i).filter(
        (i) => i === active,
      );
      expect(claimed).toHaveLength(1);
      expect(active).toBeGreaterThanOrEqual(0);
      expect(active).toBeLessThan(SCENES);
    }
  });

  it("has no memory: a value revisited out of order gives the same scene", () => {
    // This is the regression the whole refactor is about. Walk the jumbled
    // sequence, recording what each progress value produced, and require that
    // repeats agree — 0 appears at both ends, 0.28/0.24 straddle a boundary.
    const seen = new Map<number, number>();
    for (const p of NON_LINEAR) {
      const active = activeSceneIndex(storyPositionAt(p, SCENES), SCENES);
      const before = seen.get(p);
      if (before !== undefined) expect(active).toBe(before);
      seen.set(p, active);
    }
    // …and the forward pass and the reverse pass agree with each other too.
    const forward = [...NON_LINEAR]
      .sort((a, b) => a - b)
      .map((p) => activeSceneIndex(storyPositionAt(p, SCENES), SCENES));
    const reverse = [...NON_LINEAR]
      .sort((a, b) => b - a)
      .map((p) => activeSceneIndex(storyPositionAt(p, SCENES), SCENES));
    expect(forward).toEqual([...reverse].reverse());
  });
});

describe("sceneVisualAt", () => {
  it("is fully lit and interactive at its own position", () => {
    const v = sceneVisualAt(0);
    expect(v.copyOpacity).toBeCloseTo(1, 5);
    expect(v.mediaOpacity).toBeCloseTo(1, 5);
    expect(v.translateY).toBe(0);
    expect(v.visible).toBe(true);
    expect(v.interactive).toBe(true);
  });

  it("is gone, inert and untranslated-away a whole scene out", () => {
    for (const d of [1, -1, 2.5, -7]) {
      const v = sceneVisualAt(d);
      expect(v.copyOpacity).toBe(0);
      expect(v.mediaOpacity).toBe(0);
      expect(v.visible).toBe(false);
      expect(v.interactive).toBe(false);
    }
  });

  it("never lets two scenes claim the pointer", () => {
    // |distance| < 0.5 partitions the number line, so an invisible scene can
    // never sit over a button and swallow the click.
    for (const p of NON_LINEAR) {
      const position = storyPositionAt(p, SCENES);
      const interactive = Array.from({ length: SCENES }, (_, i) =>
        sceneVisualAt(position - i),
      ).filter((v) => v.interactive);
      expect(interactive.length).toBeLessThanOrEqual(1);
    }
  });

  it("keeps a crossfading pair of images at full brightness", () => {
    // Linear media opacity means the two halves of a crossfade always sum to
    // 1 — without it the panel visibly dips as one image hands to the next.
    for (const f of [0, 0.15, 0.5, 0.85, 1]) {
      const a = sceneVisualAt(-f).mediaOpacity;
      const b = sceneVisualAt(1 - f).mediaOpacity;
      expect(a + b).toBeCloseTo(1, 5);
    }
  });

  it("reverses exactly: travel flips sign, everything else is symmetric", () => {
    for (const d of [0.2, 0.5, 0.9, 1.4]) {
      const ahead = sceneVisualAt(d);
      const behind = sceneVisualAt(-d);
      expect(ahead.copyOpacity).toBeCloseTo(behind.copyOpacity, 10);
      expect(ahead.mediaOpacity).toBeCloseTo(behind.mediaOpacity, 10);
      expect(ahead.scale).toBeCloseTo(behind.scale, 10);
      expect(ahead.visible).toBe(behind.visible);
      expect(ahead.interactive).toBe(behind.interactive);
      // …and the direction of travel is the one thing that does differ.
      expect(ahead.translateY).toBeCloseTo(-behind.translateY, 10);
    }
  });

  it("fades copy monotonically as a scene recedes", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let d = 0; d <= 1.2; d += 0.05) {
      const { copyOpacity } = sceneVisualAt(d);
      expect(copyOpacity).toBeLessThanOrEqual(previous + 1e-9);
      previous = copyOpacity;
    }
  });
});

describe("curtainPanelProgress", () => {
  it("is fully down at 0 and fully lifted at 1, for every panel", () => {
    for (let i = 0; i < 5; i++) {
      expect(curtainPanelProgress(0, i)).toBe(0);
      expect(curtainPanelProgress(1, i)).toBe(1);
    }
  });

  it("staggers: a later panel trails an earlier one mid-wipe", () => {
    const mid = 0.5;
    for (let i = 1; i < 5; i++) {
      expect(curtainPanelProgress(mid, i)).toBeLessThan(
        curtainPanelProgress(mid, i - 1),
      );
    }
  });

  it("is reversible — the stagger is in the value, not in a delay", () => {
    // Walking the jumbled sequence must land every panel exactly where the
    // same progress put it before. A setTimeout-based stagger cannot do this.
    const sample = (p: number) =>
      [0, 1, 2, 3, 4].map((i) => curtainPanelProgress(p, i));
    const first = new Map(NON_LINEAR.map((p) => [p, sample(p)]));
    for (const p of [...NON_LINEAR].reverse()) {
      expect(sample(p)).toEqual(first.get(p));
    }
  });
});

describe("rampBetween", () => {
  it("maps a sub-range onto 0..1 and clamps outside it", () => {
    expect(rampBetween(0.2, 0.2, 0.6)).toBe(0);
    expect(rampBetween(0.4, 0.2, 0.6)).toBeCloseTo(0.5, 5);
    expect(rampBetween(0.6, 0.2, 0.6)).toBe(1);
    expect(rampBetween(0, 0.2, 0.6)).toBe(0);
    expect(rampBetween(9, 0.2, 0.6)).toBe(1);
  });

  it("does not blow up on a zero-width range", () => {
    expect(Number.isFinite(rampBetween(0.5, 0.3, 0.3))).toBe(true);
  });
});

describe("clamp01", () => {
  it("clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });
});
