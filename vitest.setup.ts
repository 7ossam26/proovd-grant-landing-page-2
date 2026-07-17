import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom doesn't implement the browser APIs the interactive client components
// touch on mount (GSAP/ScrollTrigger, the scroll-glide helpers, the creators
// wheel). Stub them so the full page renders in unit tests. matchMedia reports
// prefers-reduced-motion = true so every reveal effect takes its short-circuit
// path — the components render their static content, no timelines run.
vi.stubGlobal(
  "matchMedia",
  (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
);

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("ResizeObserver", ObserverStub);
vi.stubGlobal("IntersectionObserver", ObserverStub);

if (!window.scrollTo) {
  vi.stubGlobal("scrollTo", () => {});
}

// FontFaceSet isn't in jsdom; the reveal effects race document.fonts.ready.
if (!("fonts" in document)) {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve(), check: () => true },
  });
}
