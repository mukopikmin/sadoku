import { useEffect, useState } from "react";

export type CommentNavigation = {
  count: number;
  position: number | null;
  previous: (() => void) | null;
  next: (() => void) | null;
};

const emptyNavigation: CommentNavigation = {
  count: 0,
  position: null,
  previous: null,
  next: null,
};

// Navigate rendered threads so hidden source and deleted content follow the view.
export const useCommentNavigation = () => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [navigation, setNavigation] = useState(emptyNavigation);

  useEffect(() => {
    if (!root) {
      setNavigation(emptyNavigation);
      return;
    }
    const view = root.ownerDocument.defaultView;
    if (!view) return;
    let current: HTMLElement | null = null;
    let navigatedScrollY = view.scrollY;
    let previousTarget: HTMLElement | undefined;
    let nextTarget: HTMLElement | undefined;
    let positions: HTMLElement[] = [];

    const clearCurrent = () => {
      current?.removeAttribute("data-comment-navigation-current");
      current = null;
    };
    const navigate = (target: HTMLElement) => {
      clearCurrent();
      current = target;
      target.setAttribute("data-comment-navigation-current", "");
      const headerHeight =
        root.ownerDocument.querySelector("header")?.getBoundingClientRect()
          .height ?? 0;
      target.style.scrollMarginTop = `${headerHeight + 32}px`;
      target.scrollIntoView({ block: "start", behavior: "instant" });
      navigatedScrollY = view.scrollY;
      refresh();
    };
    const refresh = () => {
      const nextPositions = [
        ...root.querySelectorAll<HTMLElement>(
          ".markdown-preview .comment-thread:has(> article)",
        ),
      ];
      if (
        current &&
        (!nextPositions.includes(current) || view.scrollY !== navigatedScrollY)
      ) {
        clearCurrent();
      }
      const index = current ? nextPositions.indexOf(current) : -1;
      let previous: HTMLElement | undefined;
      let next: HTMLElement | undefined;
      if (index >= 0) {
        previous = nextPositions[index - 1];
        next = nextPositions[index + 1];
      } else {
        const headerBottom =
          root.ownerDocument.querySelector("header")?.getBoundingClientRect()
            .bottom ?? 0;
        previous = nextPositions.findLast(
          (target) => target.getBoundingClientRect().top < headerBottom,
        );
        next = nextPositions.find(
          (target) => target.getBoundingClientRect().top >= headerBottom,
        );
      }
      const unchanged =
        positions.length === nextPositions.length &&
        positions.every((target, i) => target === nextPositions[i]) &&
        previousTarget === previous &&
        nextTarget === next;
      positions = nextPositions;
      previousTarget = previous;
      nextTarget = next;
      const position = index < 0 ? null : index + 1;
      setNavigation((existing) => {
        if (
          unchanged &&
          existing.count === nextPositions.length &&
          existing.position === position
        )
          return existing;
        return {
          count: nextPositions.length,
          position,
          previous: previous ? () => navigate(previous) : null,
          next: next ? () => navigate(next) : null,
        };
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true });
    view.addEventListener("scroll", refresh, { passive: true });
    view.addEventListener("resize", refresh);
    return () => {
      clearCurrent();
      observer.disconnect();
      view.removeEventListener("scroll", refresh);
      view.removeEventListener("resize", refresh);
    };
  }, [root]);

  return { previewRef: setRoot, navigation };
};
