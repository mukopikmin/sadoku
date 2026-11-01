import { defaultSystem } from "@chakra-ui/react";

type MermaidApi = {
  initialize: (
    options: {
      startOnLoad: boolean;
      theme: "dark" | "default";
      themeVariables: { fontSize: string; useGradient: boolean };
    },
  ) => void;
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

export const initializeMermaid = async (
  {
    document = globalThis.document,
    importMermaid = () => import("mermaid"),
    prefersDark = () =>
      globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    root = document,
    theme,
  }: MermaidOptions = {},
): Promise<void> => {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(".mermaid"),
  ).filter((node) => node.dataset.processed !== "true");
  if (nodes.length === 0) return;

  const { default: mermaid } = await importMermaid();
  // Mermaid measures text using a concrete font size, rather than a CSS token.
  const fontSize = document.defaultView?.getComputedStyle(document.body).fontSize ||
    defaultSystem.token("fontSizes.md");
  mermaid.initialize({
    startOnLoad: false,
    theme: theme ?? (prefersDark() ? "dark" : "default"),
    themeVariables: { fontSize, useGradient: false },
  });
  await mermaid.run({ nodes });
};
