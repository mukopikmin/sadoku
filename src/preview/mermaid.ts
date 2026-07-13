type MermaidApi = {
  initialize: (
    options: { startOnLoad: boolean; theme: "dark" | "default" },
  ) => void;
  run: (options: { nodes: HTMLElement[] }) => Promise<void>;
};

type MermaidModule = {
  default: MermaidApi;
};

const mermaidAssetPath = "/assets/mermaid.esm.min.mjs";

export type MermaidOptions = {
  document?: Document;
  importMermaid?: () => Promise<MermaidModule>;
  prefersDark?: () => boolean;
  theme?: "dark" | "default";
};

const closeMermaidZoomDialog = (dialog: HTMLElement) => {
  dialog.remove();
};

const getSvgAspectRatio = (svg: SVGElement): number | undefined => {
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(
    Number,
  );
  if (
    viewBox?.length !== 4 ||
    !viewBox.every(Number.isFinite) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0
  ) return undefined;
  return viewBox[2] / viewBox[3];
};

const createMermaidZoomDialog = (
  document: Document,
  sourceSvg: SVGElement,
): HTMLElement => {
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

  const view = document.defaultView ?? globalThis.window;
  const aspectRatio = getSvgAspectRatio(sourceSvg);
  const resize = () => {
    if (!aspectRatio) return;
    const maxWidth = Math.max(0, view.innerWidth - 32);
    const maxHeight = Math.max(0, view.innerHeight - 32);
    const width = Math.min(maxWidth, maxHeight * aspectRatio);
    content.style.setProperty("--mermaid-zoom-width", `${width}px`);
    content.style.setProperty(
      "--mermaid-zoom-height",
      `${width / aspectRatio}px`,
    );
  };
  resize();
  view.addEventListener("resize", resize);

  const closeButton = document.createElement("button");
  closeButton.className = "mermaid-zoom-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close Mermaid diagram zoom");
  closeButton.textContent = "×";

  const scroller = document.createElement("div");
  scroller.className = "mermaid-zoom-scroller";
  scroller.append(sourceSvg.cloneNode(true));

  content.append(closeButton, scroller);
  dialog.append(backdrop, content);

  const close = () => {
    view.removeEventListener("resize", resize);
    closeMermaidZoomDialog(dialog);
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return dialog;
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
      const dialog = createMermaidZoomDialog(document, svg);
      document.body.append(dialog);
      dialog.focus();
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      open();
    });
    mermaid.addEventListener("click", open);
    container.dataset.mermaidZoomInitialized = "true";
  }
};

export const initializeMermaid = async (
  {
    document = globalThis.document,
    importMermaid = () => import(/* @vite-ignore */ mermaidAssetPath),
    prefersDark = () =>
      globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    theme,
  }: MermaidOptions = {},
): Promise<void> => {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(".mermaid"),
  ).filter((node) => node.dataset.processed !== "true");
  if (nodes.length === 0) {
    initializeMermaidZoom(document);
    return;
  }

  const { default: mermaid } = await importMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: theme ?? (prefersDark() ? "dark" : "default"),
  });
  await mermaid.run({ nodes });
  initializeMermaidZoom(document);
};
