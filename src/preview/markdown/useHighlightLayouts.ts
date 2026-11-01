import { type RefObject, useCallback, useLayoutEffect, useState } from "react";

export type HighlightLayout = {
  kind: "comment" | "selection" | "addition" | "deletion";
  top: number;
  bottom: number;
  startLine?: number;
  endLine?: number;
};

export const measureHighlightGroups = <Range>(
  preview: HTMLElement,
  groups: readonly { range: Range; elements: readonly HTMLElement[] }[],
): (Range & { top: number; bottom: number })[] => {
  const previewRect = preview.getBoundingClientRect();
  // Dialog entrance scaling changes viewport coordinates, not overlay layout.
  const scale =
    preview.offsetWidth > 0 && previewRect.width > 0
      ? previewRect.width / preview.offsetWidth
      : 1;
  return groups.flatMap(({ range, elements }) => {
    if (elements.length === 0) return [];
    const rects = elements.map((element) => element.getBoundingClientRect());
    return [
      {
        ...range,
        top:
          (Math.min(...rects.map((rect) => rect.top)) - previewRect.top) /
          scale,
        bottom:
          (Math.max(...rects.map((rect) => rect.bottom)) - previewRect.top) /
          scale,
      },
    ];
  });
};

export const useHighlightLayouts = <Layout extends HighlightLayout>(
  previewRef: RefObject<HTMLElement | null>,
  measure: (preview: HTMLElement) => Layout[],
) => {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const updateLayouts = useCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const next = measure(preview);
    setLayouts((current) =>
      current.length === next.length &&
      current.every(
        (layout, index) =>
          layout.top === next[index].top &&
          layout.bottom === next[index].bottom &&
          layout.kind === next[index].kind &&
          layout.startLine === next[index].startLine &&
          layout.endLine === next[index].endLine,
      )
        ? current
        : next,
    );
  }, [previewRef, measure]);

  useLayoutEffect(() => updateLayouts());

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const view = preview.ownerDocument.defaultView ?? globalThis;
    view.addEventListener("resize", updateLayouts);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(updateLayouts);
    observer?.observe(preview);
    return () => {
      view.removeEventListener("resize", updateLayouts);
      observer?.disconnect();
    };
  }, [previewRef, updateLayouts]);

  return layouts;
};
