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
      globalThis.scrollTo({ top: position, left: 0, behavior: "instant" });
      restored = true;
    });

    return () => {
      globalThis.removeEventListener("scroll", trackPosition, true);
      globalThis.cancelAnimationFrame(frame);
    };
  }, [contentReady, documentId, saveScrollPosition, view]);

  return saveScrollPosition;
};

export const clearScrollPositions = () => scrollPositions.clear();
