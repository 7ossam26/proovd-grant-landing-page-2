import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("landing page smoke test", () => {
  it("renders the main landmark with content and a single h1", () => {
    const { container } = render(<Home />);

    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main).not.toBeEmptyDOMElement();

    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Don’t go grey building the wrong thing.");
  });

  it("renders the key section anchors", () => {
    const { container } = render(<Home />);
    for (const id of ["idea", "creators", "risk", "days", "pricing", "faq"]) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }
  });

  it("emits valid JSON-LD with an FAQPage node", () => {
    const { container } = render(<Home />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).toBeInTheDocument();

    const graph = JSON.parse(script?.textContent ?? "{}");
    const types = (graph["@graph"] ?? []).map(
      (node: { "@type": string }) => node["@type"],
    );
    expect(types).toEqual(
      expect.arrayContaining(["Organization", "WebSite", "FAQPage"]),
    );

    const faq = (graph["@graph"] ?? []).find(
      (node: { "@type": string }) => node["@type"] === "FAQPage",
    );
    expect(faq.mainEntity.length).toBeGreaterThan(0);
    expect(faq.mainEntity[0]["@type"]).toBe("Question");
    expect(faq.mainEntity[0].acceptedAnswer.text).toBeTruthy();
  });
});
