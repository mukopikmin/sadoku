import { useLayoutEffect, useRef, useState } from "react";
import type { PreviewView } from "../models/previewView";

export const useCollapsedDocumentHeader = (
  documentId: number | undefined,
  enabled: boolean,
  view: PreviewView = "preview",
) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const documentHeaderRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"document" | "header">("document");

  useLayoutEffect(() => {
    const header = headerRef.current;
    const documentHeader = documentHeaderRef.current;
    if (!enabled || !header || !documentHeader) {
      setPlacement("document");
      return;
    }

    let frame: number | undefined;
    const update = () => {
      const rect = documentHeader.getBoundingClientRect();
      setPlacement(
        rect.height > 0 && rect.bottom <= header.getBoundingClientRect().bottom
          ? "header"
          : "document",
      );
    };
    const scheduleUpdate = () => {
      if (frame !== undefined) return;
      frame = globalThis.requestAnimationFrame(() => {
        frame = undefined;
        update();
      });
    };

    update();
    globalThis.addEventListener("scroll", scheduleUpdate, { passive: true });
    globalThis.addEventListener("resize", scheduleUpdate);
    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(scheduleUpdate);
    observer?.observe(header);
    observer?.observe(documentHeader);

    return () => {
      globalThis.removeEventListener("scroll", scheduleUpdate);
      globalThis.removeEventListener("resize", scheduleUpdate);
      observer?.disconnect();
      if (frame !== undefined) globalThis.cancelAnimationFrame(frame);
    };
  }, [documentId, enabled, view]);

  return {
    collapsed: enabled && placement === "header",
    documentHeaderRef,
    headerRef,
  };
};
