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

  it.each(
    [
      { name: "implicit dark theme", theme: undefined, expectedTheme: "dark" },
      {
        name: "explicit default theme",
        theme: "default",
        expectedTheme: "default",
      },
    ] as const,
  )(
    "initializes and renders diagrams with $name",
    async ({ theme, expectedTheme }) => {
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
        theme,
      });

      expect(calls[0]).toEqual([
        "initialize",
        expect.objectContaining({
          startOnLoad: false,
          theme: expectedTheme,
          themeVariables: { fontSize: "1rem", useGradient: false },
        }),
      ]);
      expect(calls[1]).toEqual([
        "run",
        { nodes: [document.querySelector(".mermaid")] },
      ]);
    },
  );

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
});
