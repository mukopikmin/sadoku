import { defaultSystem } from "@chakra-ui/react";

type MermaidApi = {
  initialize: (options: {
    startOnLoad: boolean;
    theme: "dark" | "default";
    themeVariables: { fontSize: string; useGradient: boolean };
  }) => void;
  run: (options: { nodes: HTMLElement[] }) => Promise<void>;
};

type MermaidModule = {
  default: MermaidApi;
};

export type MermaidOptions = {
  document?: Document;
  importMermaid?: () => Promise<MermaidModule>;
  prefersDark?: () => boolean;
  root?: ParentNode;
  theme?: "dark" | "default";
};

// Mermaid has shared rendering state. Nested previews must not render the same
// diagram concurrently or initialize the renderer during another draw.
let renderQueue: Promise<void> = Promise.resolve();

export const initializeMermaid = async ({
  document = globalThis.document,
  importMermaid = () => import("mermaid"),
  prefersDark = () =>
    globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  root = document,
  theme,
}: MermaidOptions = {}): Promise<void> => {
  const rendering = renderQueue.then(async () => {
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>(".mermaid"),
    ).filter((node) => node.dataset.processed !== "true");
    if (candidates.length === 0) return;

    const { default: mermaid } = await importMermaid();
    const nodes = candidates.filter((node) => node.isConnected);
    if (nodes.length === 0) return;
    // Mermaid measures text using a concrete font size, rather than a CSS token.
    const fontSize =
      document.defaultView?.getComputedStyle(document.body).fontSize ||
      defaultSystem.token("fontSizes.md");
    mermaid.initialize({
      startOnLoad: false,
      theme: theme ?? (prefersDark() ? "dark" : "default"),
      themeVariables: { fontSize, useGradient: false },
    });
    try {
      await mermaid.run({ nodes });
    } catch (error) {
      // Switching views can remove a preview while its async draw is running.
      if (nodes.some((node) => node.isConnected)) throw error;
    }
  });
  renderQueue = rendering.catch(() => {});
  await rendering;
};
