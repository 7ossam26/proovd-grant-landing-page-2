import { describe, expect, it, vi } from "vitest";
import { hasLiveHold, holdScroll } from "@/lib/motion";

describe("native scroll compatibility", () => {
  it("cues section choreography without pinning or moving the document", async () => {
    const target = document.createElement("section");
    document.body.appendChild(target);
    const settled = vi.fn();
    const beforeY = window.scrollY;

    const cancel = holdScroll(5_000, target, settled);

    expect(document.body.style.position).not.toBe("fixed");
    expect(document.body.style.top).toBe("");
    expect(hasLiveHold()).toBe(false);
    expect(window.scrollY).toBe(beforeY);

    await Promise.resolve();

    expect(settled).toHaveBeenCalledTimes(1);
    expect(document.body.style.position).not.toBe("fixed");
    expect(window.scrollY).toBe(beforeY);

    cancel();
    target.remove();
  });

  it("can cancel a queued entrance cue before it runs", async () => {
    const target = document.createElement("section");
    const settled = vi.fn();

    const cancel = holdScroll(5_000, target, settled);
    cancel();
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();
    expect(document.body.style.position).not.toBe("fixed");
  });
});
