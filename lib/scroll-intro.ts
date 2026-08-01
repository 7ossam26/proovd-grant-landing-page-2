export type ScrollIntroPaint = (progress: number) => void;

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function smoothstep(from: number, to: number, value: number) {
  if (from === to) return value < from ? 0 : 1;
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

/**
 * Maps the nearest <ScrollIntro> track to a reversible 0..1 timeline.
 * Native scrolling stays the only scroll authority: this helper never pins
 * the body, cancels input, calls scrollTo, or starts a timed entrance.
 */
export function bindScrollIntro(
  section: HTMLElement,
  paint: ScrollIntroPaint,
): () => void {
  const track = section.closest<HTMLElement>("[data-scroll-intro]");
  const stage = track?.querySelector<HTMLElement>(
    ":scope > [data-scroll-intro-stage]",
  );

  if (!track || !stage) {
    paint(1);
    return () => {};
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    paint(1);
    return () => {};
  }

  let frame = 0;
  let destroyed = false;

  const render = () => {
    frame = 0;
    if (destroyed) return;
    const rect = track.getBoundingClientRect();
    const travel = Math.max(1, track.offsetHeight - stage.offsetHeight);
    const progress = clamp01(-rect.top / travel);
    const value = progress.toFixed(5);
    track.style.setProperty("--intro-progress", value);
    section.style.setProperty("--intro-progress", value);
    track.dataset.scrollProgress = value;
    section.dataset.scrollProgress = value;
    paint(progress);
  };

  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  track.dataset.enhanced = "true";
  section.dataset.scrollDriven = "true";
  render();

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule);
  document.addEventListener("visibilitychange", schedule);

  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(track);
  resizeObserver.observe(stage);
  resizeObserver.observe(section);

  return () => {
    destroyed = true;
    if (frame) window.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    document.removeEventListener("visibilitychange", schedule);
    track.removeAttribute("data-enhanced");
    track.removeAttribute("data-scroll-progress");
    section.removeAttribute("data-scroll-driven");
    section.removeAttribute("data-scroll-progress");
    track.style.removeProperty("--intro-progress");
    section.style.removeProperty("--intro-progress");
  };
}
