import { describe, expect, it } from "vitest";
import { initializeMermaid, initializeMermaidZoom } from "../mermaid";
import { previewThemeCss } from "../theme";

const findCssRule = (selector: string): CSSStyleRule | undefined => {
  const style = document.createElement("style");
  style.textContent = previewThemeCss;
  document.head.append(style);
  const rule = Array.from(style.sheet?.cssRules ?? []).find((rule) =>
    "selectorText" in rule && rule.selectorText === selector
  ) as CSSStyleRule | undefined;
  style.remove();
  return rule;
};

describe("initializeMermaid", () => {
  it("does not load mermaid when the page has no diagrams", async () => {
    const document = new DOMParser().parseFromString(
      "<main><p>No diagrams.</p></main>",
      "text/html",
    );
    let loaded = false;

    await initializeMermaid({
      document,
      importMermaid: async () => {
        loaded = true;
        throw new Error("unexpected import");
      },
    });

    expect(loaded).toBe(false);
  });

  it("initializes and runs mermaid for rendered diagram blocks", async () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid">graph TD; A-->B;</pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );
    const calls: unknown[] = [];

    await initializeMermaid({
      document,
      importMermaid: async () => ({
        default: {
          initialize: (options) => calls.push(["initialize", options]),
          run: async (options) => {
            calls.push(["run", options]);
            document.querySelector(".mermaid")!.innerHTML =
              '<svg viewBox="0 0 10 10"><title>Diagram</title></svg>';
          },
        },
      }),
      prefersDark: () => true,
    });

    expect(calls[0]).toEqual([
      "initialize",
      { startOnLoad: false, theme: "dark" },
    ]);
    expect(calls[1]).toEqual([
      "run",
      { nodes: [document.querySelector(".mermaid")] },
    ]);
    expect(
      document.querySelector<HTMLElement>(".mermaid-container")?.dataset
        .mermaidZoomInitialized,
    ).toBe("true");
  });

  it("skips diagrams that mermaid has already processed", async () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid" data-processed="true"><svg></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );
    let loaded = false;

    await initializeMermaid({
      document,
      importMermaid: async () => {
        loaded = true;
        throw new Error("unexpected import");
      },
    });

    expect(loaded).toBe(false);
    expect(
      document.querySelector<HTMLElement>(".mermaid-container")?.dataset
        .mermaidZoomInitialized,
    ).toBe("true");
  });

  it("uses an explicit mermaid theme when provided", async () => {
    const document = new DOMParser().parseFromString(
      '<main><pre class="mermaid">graph TD; A-->B;</pre></main>',
      "text/html",
    );
    const calls: unknown[] = [];

    await initializeMermaid({
      document,
      importMermaid: async () => ({
        default: {
          initialize: (options) => calls.push(["initialize", options]),
          run: async (options) => calls.push(["run", options]),
        },
      }),
      prefersDark: () => true,
      theme: "default",
    });

    expect(calls[0]).toEqual([
      "initialize",
      { startOnLoad: false, theme: "default" },
    ]);
  });
});

describe("initializeMermaidZoom", () => {
  it("allows the zoomed diagram to use nearly the full viewport", () => {
    const contentRule = findCssRule(".mermaid-zoom-content");
    const scrollerRule = findCssRule(".mermaid-zoom-scroller");
    const svgRule = findCssRule(".mermaid-zoom-scroller svg");

    expect(contentRule?.style.width).toBe(
      "var(--mermaid-zoom-width, calc(100vw - 32px))",
    );
    expect(contentRule?.style.height).toBe(
      "var(--mermaid-zoom-height, calc(100vh - 32px))",
    );
    expect(contentRule?.style.padding).toBe("0px");
    expect(contentRule?.style.overflow).toBe("hidden");
    expect(scrollerRule?.style.flex).toBe("1 1 0%");
    expect(svgRule?.style.width).toBe("100%");
    expect(svgRule?.style.getPropertyPriority("max-width")).toBe("important");
  });

  it("sizes the modal to the diagram aspect ratio", () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid"><svg viewBox="0 0 200 100"></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );

    initializeMermaidZoom(document);
    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();

    const content = document.querySelector<HTMLElement>(
      ".mermaid-zoom-content",
    );
    const width = parseFloat(
      content?.style.getPropertyValue("--mermaid-zoom-width") ?? "",
    );
    const height = parseFloat(
      content?.style.getPropertyValue("--mermaid-zoom-height") ?? "",
    );
    expect(width / height).toBeCloseTo(2);
    expect(width).toBeLessThanOrEqual(window.innerWidth - 32);
    expect(height).toBeLessThanOrEqual(window.innerHeight - 32);

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-close")?.click();
  });

  it("opens a zoom dialog only from the button and removes it from close controls", () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid"><svg viewBox="0 0 10 10"><title>Diagram</title></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );

    initializeMermaidZoom(document);

    expect(
      document.querySelector<HTMLElement>(".mermaid-container")?.dataset
        .mermaidZoomInitialized,
    ).toBe("true");

    document.querySelector<HTMLElement>(".mermaid")?.click();

    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();

    expect(document.querySelector(".mermaid-zoom-dialog")).not.toBeNull();
    expect(document.querySelectorAll(".mermaid-zoom-dialog svg")).toHaveLength(
      1,
    );

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-close")?.click();

    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();
  });

  it("closes the zoom dialog with Escape and backdrop clicks", () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid"><svg></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );

    initializeMermaidZoom(document);
    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();
    document.querySelector<HTMLElement>(".mermaid-zoom-dialog")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape" }),
    );
    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();
    document.querySelector<HTMLElement>(".mermaid-zoom-backdrop")?.click();
    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();
  });
});
