import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeMermaid } from "../markdown/mermaid";

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
    expect(document.querySelector(".mermaid svg")).not.toBeNull();
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
    expect(document.querySelector(".mermaid svg")).not.toBeNull();
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
