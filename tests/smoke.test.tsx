import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("scaffold smoke test", () => {
  it("renders an empty <main> landmark", () => {
    const { container } = render(<Home />);
    const main = container.querySelector("main");

    expect(main).toBeInTheDocument();
    expect(main).toBeEmptyDOMElement();
  });
});
