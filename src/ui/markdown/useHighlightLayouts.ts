import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useEffectEvent,
  type ReactNode,
  useState,
} from "react";

export type HighlightLayout = {
  kind: "comment" | "selection" | "hover" | "addition" | "deletion";
  top: number;
  bottom: number;
  outsetLeft?: number;
  outsetRight?: number;
  startLine?: number;
  endLine?: number;
};

export const measureHighlightGroups = <Range>(
  preview: HTMLElement,
  groups: readonly {
    range: Range;
    elements: readonly HTMLElement[];
    table?: HTMLElement;
  }[],
): (Range &
  Pick<HighlightLayout, "top" | "bottom" | "outsetLeft" | "outsetRight">)[] => {
  const previewRect = preview.getBoundingClientRect();
  // Dialog entrance scaling changes viewport coordinates, not overlay layout.
  const scale =
    preview.offsetWidth > 0 && previewRect.width > 0
      ? previewRect.width / preview.offsetWidth
      : 1;
  return groups.flatMap(({ range, elements, table }) => {
    if (elements.length === 0) return [];
    const rects = elements.map((element) => element.getBoundingClientRect());
    const tableRect = table?.getBoundingClientRect();
    const outsetLeft = tableRect
      ? (previewRect.left - tableRect.left) / scale
      : 0;
    const outsetRight = tableRect
      ? (tableRect.right - previewRect.right) / scale
      : 0;
    return [
      {
        ...range,
        ...(outsetLeft > 0 && { outsetLeft }),
        ...(outsetRight > 0 && { outsetRight }),
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
  measure: (preview: HTMLElement, resized: boolean) => Layout[],
  resizeTargetSelector?: string,
  content?: ReactNode,
) => {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const updateLayouts = useCallback(
    (resized: boolean) => {
      const preview = previewRef.current;
      if (!preview) return;
      const next = measure(preview, resized);
      setLayouts((current) =>
        current.length === next.length &&
        current.every(
          (layout, index) =>
            layout.top === next[index].top &&
            layout.bottom === next[index].bottom &&
            layout.outsetLeft === next[index].outsetLeft &&
            layout.outsetRight === next[index].outsetRight &&
            layout.kind === next[index].kind &&
            layout.startLine === next[index].startLine &&
            layout.endLine === next[index].endLine,
        )
          ? current
          : next,
      );
    },
    [previewRef, measure],
  );

  const onResize = useEffectEvent(() => updateLayouts(true));
  useLayoutEffect(() => {
    updateLayouts(false);
  });

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const view = preview.ownerDocument.defaultView ?? globalThis;
    view.addEventListener("resize", onResize);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(onResize);
    observer?.observe(preview);
    if (observer && resizeTargetSelector) {
      preview
        .querySelectorAll(resizeTargetSelector)
        .forEach((target) => observer.observe(target));
    }
    return () => {
      view.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [previewRef, resizeTargetSelector, content]);

  return layouts;
};
