import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeMermaid, initializeMermaidZoom } from "../markdown/mermaid";

const bundledMermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  run: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("mermaid", () => ({ default: bundledMermaid }));

afterEach(() => vi.restoreAllMocks());

describe("initializeMermaid", () => {
  it("loads Mermaid through the Vite dependency graph", async () => {
    const document = new DOMParser().parseFromString(
      '<main><pre class="mermaid">graph TD; A-->B;</pre></main>',
      "text/html",
    );

    await initializeMermaid({ document, prefersDark: () => false });

    expect(bundledMermaid.initialize).toHaveBeenCalledOnce();
    expect(bundledMermaid.run).toHaveBeenCalledWith({
      nodes: [document.querySelector(".mermaid")],
    });
  });
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
      expect.objectContaining({
        startOnLoad: false,
        theme: "dark",
      }),
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
      expect.objectContaining({
        startOnLoad: false,
        theme: "default",
      }),
    ]);
  });
});

describe("initializeMermaidZoom", () => {
  it("enables pinch zoom only inside the zoom dialog", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid"><svg viewBox="0 0 200 100"></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );
    const diagram = document.querySelector<HTMLElement>(".mermaid")!;
    const svg = diagram.querySelector<SVGSVGElement>("svg")!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 200, 100),
    );

    initializeMermaidZoom(document);
    initializeMermaidZoom(document);
    const pinch = () =>
      new WheelEvent("wheel", {
        ctrlKey: true,
        deltaY: -Math.log(2) / 0.01,
        cancelable: true,
      });
    const inlinePinch = pinch();
    diagram.dispatchEvent(inlinePinch);
    expect(inlinePinch.defaultPrevented).toBe(false);
    expect(diagram.style.getPropertyValue("--mermaid-pinch-width")).toBe("");
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { scale: 2, clientX: 100, clientY: 50 });
      diagram.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")!.click();
    const scroller = document.querySelector<HTMLElement>(
      ".mermaid-zoom-scroller",
    )!;
    expect(scroller.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "600px",
    );
    const modalPinch = pinch();
    scroller.dispatchEvent(modalPinch);
    expect(modalPinch.defaultPrevented).toBe(true);
    expect(scroller.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "1200px",
    );
    const modalPinchOut = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: Math.log(2) / 0.01,
      cancelable: true,
    });
    scroller.dispatchEvent(modalPinchOut);
    expect(modalPinchOut.defaultPrevented).toBe(true);
    expect(scroller.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "600px",
    );
    scroller.dispatchEvent(pinch());
    document.querySelector<HTMLButtonElement>(".mermaid-zoom-fit")!.click();
    expect(scroller.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "600px",
    );
    expect(scroller.scrollLeft).toBe(0);
    expect(scroller.scrollTop).toBe(0);
    expect(diagram.style.getPropertyValue("--mermaid-pinch-width")).toBe("");

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-close")!.click();
    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")!.click();
    const reopened = document.querySelector<HTMLElement>(
      ".mermaid-zoom-scroller",
    )!;
    expect(reopened.style.getPropertyValue("--mermaid-pinch-width")).toBe(
      "600px",
    );
    expect(reopened.querySelector("svg")!.getAttribute("viewBox")).toBe(
      "0 0 200 100",
    );
    document.querySelector<HTMLButtonElement>(".mermaid-zoom-close")!.click();
  });

  it("provides fit and close controls above the diagram viewport", () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid"><svg viewBox="0 0 200 100"></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );

    initializeMermaidZoom(document);
    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();

    const toolbar = document.querySelector(".mermaid-zoom-toolbar")!;
    const fitButton = toolbar.querySelector<HTMLButtonElement>(
      ".mermaid-zoom-fit",
    )!;
    expect(fitButton.getAttribute("aria-label")).toBe(
      "Fit Mermaid diagram to view",
    );
    expect(toolbar.querySelector(".mermaid-zoom-close")).not.toBeNull();
    expect(toolbar.querySelector("svg")).toBeNull();
    expect(document.querySelector(".mermaid-zoom-scroller svg")).not.toBeNull();

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
