import { useLayoutEffect, useRef, useState } from "react";
import { useMermaidRendering } from "../markdown/useMermaidRendering";

type SourceState =
  { status: "collapsed"; canExpand: boolean } | { status: "expanded" };
export const useExpandableSource = (content: string) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SourceState>({
    status: "collapsed",
    canExpand: false,
  });
  useMermaidRendering(contentRef, [content]);
  const expanded = state.status === "expanded";
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || expanded) return;
    const update = () =>
      setState({
        status: "collapsed",
        canExpand: element.scrollHeight > element.clientHeight,
      });
    update();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [content, expanded]);
  return {
    state,
    contentRef,
    toggle: () =>
      setState((current) =>
        current.status === "expanded"
          ? { status: "collapsed", canExpand: true }
          : current.canExpand
            ? { status: "expanded" }
            : current,
      ),
  };
};
