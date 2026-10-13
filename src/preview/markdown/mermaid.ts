import { initializeMermaidPinchZoom } from "./mermaidPinchZoom";

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

const closeMermaidZoomDialog = (dialog: HTMLElement) => {
  dialog.remove();
};

const openMermaidZoomDialog = (
  document: Document,
  sourceSvg: SVGElement,
): void => {
  const dialog = document.createElement("div");
  dialog.className = "mermaid-zoom-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Zoomed Mermaid diagram");
  dialog.tabIndex = -1;

  const backdrop = document.createElement("div");
  backdrop.className = "mermaid-zoom-backdrop";

  const content = document.createElement("div");
  content.className = "mermaid-zoom-content";

  const toolbar = document.createElement("div");
  toolbar.className = "mermaid-zoom-toolbar";
  const fitButton = document.createElement("button");
  fitButton.className = "mermaid-zoom-fit";
  fitButton.type = "button";
  fitButton.setAttribute("aria-label", "Fit Mermaid diagram to view");
  fitButton.textContent = "Fit to view";

  const closeButton = document.createElement("button");
  closeButton.className = "mermaid-zoom-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close Mermaid diagram zoom");
  closeButton.textContent = "×";

  const scroller = document.createElement("div");
  scroller.className = "mermaid-zoom-scroller";
  scroller.append(sourceSvg.cloneNode(true));

  toolbar.append(fitButton, closeButton);
  content.append(toolbar, scroller);
  dialog.append(backdrop, content);
  document.body.append(dialog);
  const zoom = initializeMermaidPinchZoom(scroller);

  const close = () => {
    zoom.destroy();
    closeMermaidZoomDialog(dialog);
  };
  fitButton.addEventListener("click", zoom.fit);
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  dialog.focus();
};

export const initializeMermaidZoom = (
  document: Document = globalThis.document,
): void => {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>(".mermaid-container"),
  );

  for (const container of containers) {
    if (container.dataset.mermaidZoomInitialized === "true") continue;
    const mermaid = container.querySelector<HTMLElement>(".mermaid");
    const button = container.querySelector<HTMLButtonElement>(
      ".mermaid-zoom-button",
    );
    if (!mermaid || !button) continue;

    const open = () => {
      const svg = mermaid.querySelector<SVGElement>("svg");
      if (!svg) return;
      openMermaidZoomDialog(document, svg);
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      open();
    });
    container.dataset.mermaidZoomInitialized = "true";
  }
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
  if (nodes.length === 0) {
    initializeMermaidZoom(document);
    return;
  }

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
  initializeMermaidZoom(document);
};
