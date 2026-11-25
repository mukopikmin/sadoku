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
      if (
        current &&
        (!positions.includes(current) || view.scrollY !== navigatedScrollY)
      ) {
        clearCurrent();
      }
      const index = current ? positions.indexOf(current) : -1;
      let previous: HTMLElement | undefined;
      let next: HTMLElement | undefined;
      if (index >= 0) {
        previous = positions[index - 1];
        next = positions[index + 1];
      } else {
        const headerBottom =
          root.ownerDocument.querySelector("header")?.getBoundingClientRect()
            .bottom ?? 0;
        previous = positions.findLast(
          (target) => target.getBoundingClientRect().top < headerBottom,
        );
        next = positions.find(
          (target) => target.getBoundingClientRect().top >= headerBottom,
        );
      }
      const unchanged = previousTarget === previous && nextTarget === next;
      previousTarget = previous;
      nextTarget = next;
      const position = index < 0 ? null : index + 1;
      const count = positions.length;
      setNavigation((existing) => {
        if (
          unchanged &&
          existing.count === count &&
          existing.position === position
        )
          return existing;
        return {
          count,
          position,
          previous: previous ? () => navigate(previous) : null,
          next: next ? () => navigate(next) : null,
        };
      });
    };

    const collectThreads = () => {
      positions = [
        ...root.querySelectorAll<HTMLElement>(
          ".markdown-preview .comment-thread:has(> article)",
        ),
      ];
      refresh();
    };
    collectThreads();
    const mayContainThread = (node: Node) =>
      node instanceof Element &&
      (node.matches(".comment-thread, article") ||
        node.querySelector(".comment-thread, article") !== null);
    const observer = new MutationObserver((records) => {
      const membershipChanged = records.some((record) => {
        if (record.type === "childList") {
          return [...record.addedNodes, ...record.removedNodes].some(
            mayContainThread,
          );
        }
        const target = record.target;
        if (!(target instanceof Element)) return false;
        const oldClasses = (record.oldValue ?? "").split(/\s+/);
        return ["comment-thread", "markdown-preview"].some(
          (name) =>
            oldClasses.includes(name) !== target.classList.contains(name),
        );
      });
      if (membershipChanged) collectThreads();
      else if (
        records.some(
          ({ type, target }) =>
            type === "childList" &&
            !(
              target instanceof Element &&
              target.closest(".markdown-range-highlights")
            ),
        )
      )
        refresh();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
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
