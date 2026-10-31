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

  it("serializes overlapping previews and renders each diagram only once", async () => {
    const document = new DOMParser().parseFromString(
      '<main><section><pre class="mermaid">graph TD; A-->B;</pre></section><pre class="mermaid">graph TD; A-->C;</pre></main>',
      "text/html",
    );
    let release!: () => void;
    const drawing = new Promise<void>((resolve) => {
      release = resolve;
    });
    const initialize = vi.fn();
    const run = vi.fn(async ({ nodes }: { nodes: HTMLElement[] }) => {
      await drawing;
      for (const node of nodes) node.dataset.processed = "true";
    });
    const importMermaid = async () => ({ default: { initialize, run } });
    const nested = initializeMermaid({
      document,
      root: document.querySelector("section")!,
      importMermaid,
    });
    const parent = initializeMermaid({ document, importMermaid });
    try {
      await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
      expect(initialize).toHaveBeenCalledOnce();
    } finally {
      release();
      await Promise.all([nested, parent]);
    }
    expect(run.mock.calls.map(([{ nodes }]) => nodes)).toEqual(
      [...document.querySelectorAll<HTMLElement>(".mermaid")].map((node) => [node]),
    );
  });

  it("allows later renders after a failed initialization", async () => {
    const document = new DOMParser().parseFromString(
      '<main><pre class="mermaid">graph TD; A-->B;</pre></main>',
      "text/html",
    );
    const run = vi.fn(async () => {});
    const importMermaid = vi.fn()
      .mockRejectedValueOnce(new Error("Mermaid load failed"))
      .mockResolvedValue({ default: { initialize: vi.fn(), run } });
    await expect(initializeMermaid({ document, importMermaid }))
      .rejects.toThrow("Mermaid load failed");
    await initializeMermaid({ document, importMermaid });
    expect(run).toHaveBeenCalledOnce();
  });

  it("skips diagrams removed while Mermaid is loading", async () => {
    const document = new DOMParser().parseFromString(
      '<main><pre class="mermaid">graph TD; A-->B;</pre></main>',
      "text/html",
    );
    let release!: () => void;
    const loading = new Promise<void>((resolve) => {
      release = resolve;
    });
    const initialize = vi.fn();
    const run = vi.fn(async () => {});
    const importMermaid = vi.fn(async () => {
      await loading;
      return { default: { initialize, run } };
    });
    const rendering = initializeMermaid({ document, importMermaid });
    try {
      await vi.waitFor(() => expect(importMermaid).toHaveBeenCalledOnce());
      document.querySelector(".mermaid")!.remove();
    } finally {
      release();
      await rendering;
    }
    expect(initialize).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("treats a preview removed during drawing as canceled", async () => {
    const document = new DOMParser().parseFromString(
      '<main><pre class="mermaid">graph TD; A-->B;</pre></main>',
      "text/html",
    );
    let release!: () => void;
    const drawing = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = vi.fn(async () => {
      await drawing;
      throw new Error("Preview was removed");
    });
    const rendering = initializeMermaid({
      document,
      importMermaid: async () => ({ default: { initialize: vi.fn(), run } }),
    });
    try {
      await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
      document.querySelector(".mermaid")!.remove();
    } finally {
      release();
      await expect(rendering).resolves.toBeUndefined();
    }
  });

  it("propagates drawing failures for diagrams that are still attached", async () => {
    const document = new DOMParser().parseFromString(
      '<main><pre class="mermaid">graph TD; A-->B;</pre></main>',
      "text/html",
    );
    const importMermaid = async () => ({
      default: {
        initialize: vi.fn(),
        run: async () => {
          throw new Error("Invalid diagram");
        },
      },
    });
    await expect(initializeMermaid({ document, importMermaid }))
      .rejects.toThrow("Invalid diagram");
  });
});
