import { type RefObject, useLayoutEffect } from "react";

const headingSelector = "h1, h2, h3, h4, h5, h6";

export const scrollToHeadingHash = (
  preview: HTMLElement,
  hash: string,
): boolean => {
  const encodedId = hash.slice(1);
  if (!encodedId) return false;

  let id: string;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    return false;
  }

  const document = preview.ownerDocument;
  const heading = document.getElementById(id);
  if (!heading?.matches(headingSelector) || !preview.contains(heading)) {
    return false;
  }

  const headerHeight = document.querySelector("header")
    ?.getBoundingClientRect().height ?? 0;
  heading.style.scrollMarginTop = `${headerHeight}px`;
  heading.scrollIntoView();
  return true;
};

export const useHeadingHashNavigation = (
  previewRef: RefObject<HTMLElement | null>,
  contentKey: string,
) => {
  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const view = preview.ownerDocument.defaultView ?? globalThis;
    const scrollToHash = () => {
      scrollToHeadingHash(preview, view.location.hash);
    };

    scrollToHash();
    view.addEventListener("hashchange", scrollToHash);
    return () => view.removeEventListener("hashchange", scrollToHash);
  }, [contentKey, previewRef]);
};
