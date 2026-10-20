type MermaidApi = {
  initialize: (
    options: {
      startOnLoad: boolean;
      theme: "dark" | "default";
      themeVariables: { fontSize: string };
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
  const fontScale = Number(
    document.documentElement.style.getPropertyValue("--sadoku-font-scale"),
  ) || 1;
  mermaid.initialize({
    startOnLoad: false,
    theme: theme ?? (prefersDark() ? "dark" : "default"),
    themeVariables: { fontSize: `${fontScale}rem` },
  });
  await mermaid.run({ nodes });
};
