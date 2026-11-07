import { useEffect, type DependencyList, type RefObject } from "react";
import { initializeMermaid } from "./mermaid";

export const useMermaidRendering = (
  root: RefObject<HTMLElement | null> | undefined,
  dependencies: DependencyList,
  theme?: "dark" | "default",
) => {
  useEffect(() => {
    if (root && !root.current) return;
    void initializeMermaid({
      ...(root?.current ? { root: root.current } : {}),
      theme:
        theme ??
        (document.documentElement.dataset.theme === "dark"
          ? "dark"
          : "default"),
    });
  }, dependencies);
};
