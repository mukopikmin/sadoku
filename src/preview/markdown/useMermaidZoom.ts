import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { initializeMermaidPinchZoom } from "./mermaidPinchZoom";
export const useMermaidZoom = (sourceRef: RefObject<HTMLPreElement | null>) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ReturnType<typeof initializeMermaidPinchZoom>>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const svg = sourceRef.current?.querySelector("svg");
    if (!viewport || !svg) return;
    viewport.replaceChildren(svg.cloneNode(true));
    const zoom = initializeMermaidPinchZoom(viewport);
    zoomRef.current = zoom;
    return () => {
      zoom.destroy();
      zoomRef.current = null;
      viewport.replaceChildren();
    };
  }, [sourceRef]);

  return {
    viewportRef,
    fit: () => zoomRef.current?.fit(),
    zoomIn: () => zoomRef.current?.zoomIn(),
    zoomOut: () => zoomRef.current?.zoomOut(),
  };
};

export const useMermaidDiagram = () => {
  const sourceRef = useRef<HTMLPreElement>(null);
  const [state, setState] = useState<{ status: "closed" | "open" }>({
    status: "closed",
  });
  return {
    sourceRef,
    state,
    setOpen: (open: boolean) =>
      setState({
        status:
          open && sourceRef.current?.querySelector("svg") ? "open" : "closed",
      }),
  };
};
