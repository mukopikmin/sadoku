import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export type ScrollView = "preview" | "comments";

const scrollPositions = new Map<string, number>();

const scrollKey = (documentId: number, view: ScrollView) =>
  `${documentId}:${view}`;

/**
 * Restores scroll for document/view transitions, including browser history
 * traversal. The popstate marker prevents the outgoing view's cleanup from
 * overwriting its previously saved position after the URL has changed.
 */
export const useScrollPosition = (
  documentId: number | undefined,
  view: ScrollView,
  contentReady: boolean,
) => {
  const historyTraversal = useRef(false);
  const savedBeforeNavigation = useRef(false);
  const saveCurrentPosition = useCallback(() => {
    if (
      documentId !== undefined && contentReady && !historyTraversal.current
    ) {
      scrollPositions.set(scrollKey(documentId, view), globalThis.scrollY);
    }
  }, [contentReady, documentId, view]);
  const saveScrollPosition = useCallback(() => {
    saveCurrentPosition();
    savedBeforeNavigation.current = true;
  }, [saveCurrentPosition]);

  useEffect(() => {
    const markHistoryTraversal = () => {
      historyTraversal.current = true;
    };
    globalThis.addEventListener("popstate", markHistoryTraversal);
    return () =>
      globalThis.removeEventListener("popstate", markHistoryTraversal);
  }, []);

  useLayoutEffect(() => {
    if (documentId === undefined || !contentReady) return;

    const key = scrollKey(documentId, view);
    if (historyTraversal.current) {
      historyTraversal.current = false;
    }

    const frame = globalThis.requestAnimationFrame(() => {
      globalThis.scrollTo({
        top: scrollPositions.get(key) ?? 0,
        left: 0,
        behavior: "instant",
      });
    });

    return () => {
      globalThis.cancelAnimationFrame(frame);
      if (savedBeforeNavigation.current) {
        savedBeforeNavigation.current = false;
      } else {
        saveCurrentPosition();
      }
    };
  }, [contentReady, documentId, saveCurrentPosition, view]);

  return saveScrollPosition;
};

export const clearScrollPositions = () => scrollPositions.clear();
