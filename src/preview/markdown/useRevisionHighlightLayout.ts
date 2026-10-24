import { type RefObject, useCallback, useLayoutEffect, useState } from "react";

type RevisionHighlightLayout = {
  bottom: number;
  kind: "addition" | "deletion";
  top: number;
};

export const measureRevisionHighlightLayouts = (
  preview: HTMLElement,
): RevisionHighlightLayout[] => {
  const previewRect = preview.getBoundingClientRect();
  // Dialog entrance scaling affects viewport rectangles, but overlay positions
  // use the document's unscaled layout coordinates.
  const scale = preview.offsetWidth > 0 && previewRect.width > 0
    ? previewRect.width / preview.offsetWidth
    : 1;
  return [...preview.querySelectorAll<HTMLElement>("[data-revision-kind]")]
    .flatMap((element) => {
      const kind = element.dataset.revisionKind;
      if (kind !== "addition" && kind !== "deletion") return [];
      const rect = element.getBoundingClientRect();
      return [{
        kind,
        top: (rect.top - previewRect.top) / scale,
        bottom: (rect.bottom - previewRect.top) / scale,
      }];
    });
};

export const useRevisionHighlightLayout = (
  previewRef: RefObject<HTMLElement | null>,
) => {
  const [layouts, setLayouts] = useState<RevisionHighlightLayout[]>([]);
  const updateLayouts = useCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const next = measureRevisionHighlightLayouts(preview);
    setLayouts((current) =>
      current.length === next.length &&
        current.every((layout, index) =>
          layout.top === next[index].top &&
          layout.bottom === next[index].bottom &&
          layout.kind === next[index].kind
        )
        ? current
        : next
    );
  }, [previewRef]);

  useLayoutEffect(() => updateLayouts());

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const view = preview.ownerDocument.defaultView ?? globalThis;
    view.addEventListener("resize", updateLayouts);
    const observer = typeof ResizeObserver === "undefined"
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
