import { useCallback, useLayoutEffect } from "react";

export type ScrollView = "preview" | "comments";

const scrollPositions = new Map<string, number>();
const scrollKey = (documentId: number, view: ScrollView) =>
  `${documentId}:${view}`;

/** Owns document scroll restoration after query-backed content is ready. */
export const useScrollPosition = (
  documentId: number | undefined,
  view: ScrollView,
  contentReady: boolean,
  targetLine?: number,
) => {
  const saveScrollPosition = useCallback(() => {
    if (documentId !== undefined && contentReady) {
      scrollPositions.set(scrollKey(documentId, view), globalThis.scrollY);
    }
  }, [contentReady, documentId, view]);

  useLayoutEffect(() => {
    if (documentId === undefined || !contentReady) return;

    const position = scrollPositions.get(scrollKey(documentId, view)) ?? 0;
    let restored = false;
    const trackPosition = () => {
      if (restored) saveScrollPosition();
    };
    // Save while this view is active. Cleanup may run after its content was
    // removed and the browser already clamped scrollY to the new page height.
    globalThis.addEventListener("scroll", trackPosition, true);
    const frame = globalThis.requestAnimationFrame(() => {
      let target: HTMLElement | undefined;
      if (targetLine !== undefined) {
        const blocks = document.querySelectorAll<HTMLElement>(
          ".markdown-preview .commentable-block[data-source-line]",
        );
        for (const block of blocks) {
          const start = Number(block.dataset.sourceLine);
          const end = Number(block.dataset.sourceEndLine);
          if (
            start <= targetLine &&
            targetLine <= end &&
            (!target ||
              end - start <
                Number(target.dataset.sourceEndLine) -
                  Number(target.dataset.sourceLine))
          ) {
            target = block;
          }
        }
      }
      if (target) {
        const headerHeight =
          document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        target.style.scrollMarginTop = `${headerHeight}px`;
        target.scrollIntoView({ block: "start", behavior: "instant" });
      } else {
        globalThis.scrollTo({ top: position, left: 0, behavior: "instant" });
      }
      restored = true;
    });

    return () => {
      globalThis.removeEventListener("scroll", trackPosition, true);
      globalThis.cancelAnimationFrame(frame);
    };
  }, [contentReady, documentId, saveScrollPosition, targetLine, view]);

  return saveScrollPosition;
};

export const clearScrollPositions = () => scrollPositions.clear();
