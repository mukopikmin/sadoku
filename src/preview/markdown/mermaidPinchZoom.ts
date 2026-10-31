type GestureEvent = Event & {
  scale: number;
  clientX: number;
  clientY: number;
};

const getSvgDimensions = (svg: SVGSVGElement | null) => {
  if (!svg) return undefined;
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(
    Number,
  );
  if (
    viewBox?.length === 4 && viewBox.every(Number.isFinite) &&
    viewBox[2] > 0 && viewBox[3] > 0
  ) return { width: viewBox[2], height: viewBox[3] };
  const bounds = svg.getBoundingClientRect();
  return bounds.width > 0 && bounds.height > 0
    ? { width: bounds.width, height: bounds.height }
    : undefined;
};

export const initializeMermaidPinchZoom = (viewport: HTMLElement) => {
  const svg = viewport.querySelector<SVGSVGElement>("svg");
  const dimensions = getSvgDimensions(svg);
  const stage = viewport.ownerDocument.createElement("div");
  stage.className = "mermaid-zoom-stage";
  if (svg) {
    stage.append(svg);
    viewport.append(stage);
  }
  const view = viewport.ownerDocument.defaultView ?? globalThis.window;
  let scale = 1;
  let gestureStartScale: number | undefined;
  let layout: {
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    offsetX: number;
    offsetY: number;
  } | undefined;

  const updateLayout = () => {
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (!dimensions || viewportWidth <= 0 || viewportHeight <= 0) return false;
    const fitScale = Math.min(
      1,
      viewportWidth / dimensions.width,
      viewportHeight / dimensions.height,
    );
    const width = dimensions.width * fitScale * scale;
    const height = dimensions.height * fitScale * scale;
    layout = {
      width,
      height,
      viewportWidth,
      viewportHeight,
      offsetX: Math.max(0, (viewportWidth - width) / 2),
      offsetY: Math.max(0, (viewportHeight - height) / 2),
    };
    viewport.style.setProperty("--mermaid-pinch-width", `${width}px`);
    viewport.style.setProperty("--mermaid-pinch-height", `${height}px`);
    stage.style.width = `${Math.max(viewportWidth, width)}px`;
    stage.style.height = `${Math.max(viewportHeight, height)}px`;
    return true;
  };

  const setScroll = (x: number, y: number) => {
    if (!layout) return;
    viewport.scrollLeft = Math.max(
      0,
      Math.min(x, layout.width - layout.viewportWidth),
    );
    viewport.scrollTop = Math.max(
      0,
      Math.min(y, layout.height - layout.viewportHeight),
    );
  };

  const fit = () => {
    scale = 1;
    gestureStartScale = undefined;
    updateLayout();
    setScroll(0, 0);
  };

  const resize = () => {
    if (!layout) {
      updateLayout();
      return;
    }
    const centerX = (viewport.scrollLeft + layout.viewportWidth / 2 -
      layout.offsetX) / layout.width;
    const centerY = (viewport.scrollTop + layout.viewportHeight / 2 -
      layout.offsetY) / layout.height;
    if (!updateLayout()) return;
    setScroll(
      centerX * layout.width + layout.offsetX - layout.viewportWidth / 2,
      centerY * layout.height + layout.offsetY - layout.viewportHeight / 2,
    );
  };

  const zoomTo = (nextScale: number, clientX: number, clientY: number) => {
    if (!layout && !updateLayout()) return false;
    if (!layout || !Number.isFinite(nextScale) || nextScale <= 0) return false;
    const bounds = viewport.getBoundingClientRect();
    const x = clientX - bounds.left - viewport.clientLeft;
    const y = clientY - bounds.top - viewport.clientTop;
    const pointX = (viewport.scrollLeft + x - layout.offsetX) / layout.width;
    const pointY = (viewport.scrollTop + y - layout.offsetY) / layout.height;
    scale = Math.min(4, Math.max(0.25, nextScale));
    updateLayout();
    setScroll(
      pointX * layout.width + layout.offsetX - x,
      pointY * layout.height + layout.offsetY - y,
    );
    return true;
  };

  const zoomBy = (factor: number) => {
    const bounds = viewport.getBoundingClientRect();
    zoomTo(
      scale * factor,
      bounds.left + viewport.clientLeft + viewport.clientWidth / 2,
      bounds.top + viewport.clientTop + viewport.clientHeight / 2,
    );
  };

  // Chromium and Firefox report trackpad pinches as Ctrl+wheel events.
  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey || (!layout && !updateLayout())) return;
    event.preventDefault();
    if (gestureStartScale !== undefined) return;
    const delta = event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
        ? viewport.clientHeight
        : 1);
    zoomTo(
      scale * Math.exp(Math.max(-20, Math.min(20, -delta * 0.01))),
      event.clientX,
      event.clientY,
    );
  };

  // Safari reports trackpad pinches through gesture events instead.
  const onGestureStart = (event: Event) => {
    if (!layout && !updateLayout()) return;
    event.preventDefault();
    gestureStartScale = scale;
  };
  const onGestureChange = (event: Event) => {
    if (gestureStartScale === undefined) return;
    const gesture = event as GestureEvent;
    if (
      zoomTo(
        gestureStartScale * gesture.scale,
        gesture.clientX,
        gesture.clientY,
      )
    ) {
      event.preventDefault();
    }
  };
  const onGestureEnd = (event: Event) => {
    if (gestureStartScale === undefined) return;
    event.preventDefault();
    gestureStartScale = undefined;
  };

  fit();
  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("gesturestart", onGestureStart, { passive: false });
  viewport.addEventListener("gesturechange", onGestureChange, {
    passive: false,
  });
  viewport.addEventListener("gestureend", onGestureEnd, { passive: false });
  view.addEventListener("resize", resize);
  const observer = typeof ResizeObserver === "undefined"
    ? undefined
    : new ResizeObserver(resize);
  observer?.observe(viewport);

  return {
    fit,
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    destroy: () => {
      observer?.disconnect();
      view.removeEventListener("resize", resize);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("gesturestart", onGestureStart);
      viewport.removeEventListener("gesturechange", onGestureChange);
      viewport.removeEventListener("gestureend", onGestureEnd);
    },
  };
};
