import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeMermaidPinchZoom } from "../markdown/mermaidPinchZoom";

const controllers: ReturnType<typeof initializeMermaidPinchZoom>[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const createViewport = (diagramWidth = 200, diagramHeight = 100) => {
  const viewport = document.createElement("div");
  viewport.innerHTML =
    `<svg viewBox="0 0 ${diagramWidth} ${diagramHeight}"></svg>`;
  const width = vi.spyOn(viewport, "clientWidth", "get").mockReturnValue(240);
  const height = vi.spyOn(viewport, "clientHeight", "get").mockReturnValue(140);
  vi.spyOn(viewport, "getBoundingClientRect").mockImplementation(() =>
    new DOMRect(10, 10, viewport.clientWidth, viewport.clientHeight)
  );
  const controller = initializeMermaidPinchZoom(viewport);
  controllers.push(controller);
  return {
    viewport,
    controller,
    resize: (nextWidth: number, nextHeight: number, notify = true) => {
      width.mockReturnValue(nextWidth);
      height.mockReturnValue(nextHeight);
      if (notify) window.dispatchEvent(new Event("resize"));
    },
  };
};

const pinch = (viewport: HTMLElement, deltaY: number, ctrlKey = true) => {
  const event = new WheelEvent("wheel", {
    deltaY,
    ctrlKey,
    clientX: 130,
    clientY: 80,
    bubbles: true,
    cancelable: true,
  });
  viewport.dispatchEvent(event);
  return event;
};

const gesture = (viewport: HTMLElement, type: string, scale = 1) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { scale, clientX: 130, clientY: 80 });
  viewport.dispatchEvent(event);
  return event;
};

const diagramSize = (viewport: HTMLElement) => ({
  width: parseFloat(viewport.style.getPropertyValue("--mermaid-pinch-width")),
  height: parseFloat(viewport.style.getPropertyValue("--mermaid-pinch-height")),
});

const doubleScaleDelta = -Math.log(2) / 0.01;

describe("Mermaid zoom dialog trackpad pinch zoom", () => {
  it.each([
    [200, 100, 240, 120],
    [100, 1000, 14, 140],
    [1000, 100, 240, 24],
  ])(
    "fits a %s by %s diagram inside the viewport",
    (w, h, fittedW, fittedH) => {
      const { viewport } = createViewport(w, h);
      expect(diagramSize(viewport).width).toBeCloseTo(fittedW);
      expect(diagramSize(viewport).height).toBeCloseTo(fittedH);
      expect(viewport.scrollLeft).toBe(0);
      expect(viewport.scrollTop).toBe(0);
    },
  );

  it("zooms in and out relative to the fitted diagram", () => {
    const { viewport } = createViewport();
    expect(pinch(viewport, doubleScaleDelta).defaultPrevented).toBe(true);
    expect(diagramSize(viewport)).toEqual({ width: 480, height: 240 });
    expect(pinch(viewport, -doubleScaleDelta).defaultPrevented).toBe(true);
    expect(diagramSize(viewport)).toEqual({ width: 240, height: 120 });
  });

  it("keeps the point under the cursor in place when leaving the centered fit", () => {
    const { viewport } = createViewport();
    pinch(viewport, doubleScaleDelta);
    expect(viewport.scrollLeft).toBeCloseTo(120);
    expect(viewport.scrollTop).toBeCloseTo(50);

    viewport.scrollLeft = 40;
    viewport.scrollTop = 20;
    pinch(viewport, doubleScaleDelta);
    expect(viewport.scrollLeft).toBeCloseTo(200);
    expect(viewport.scrollTop).toBeCloseTo(110);
  });

  it("zooms with controls around the viewed center, including after scrolling", () => {
    const { viewport, controller } = createViewport();
    controller.zoomIn();
    expect(diagramSize(viewport)).toEqual({ width: 300, height: 150 });
    expect(viewport.scrollLeft).toBeCloseTo(30);
    expect(viewport.scrollTop).toBeCloseTo(5);

    viewport.scrollLeft = 45;
    viewport.scrollTop = 10;
    controller.zoomIn();
    expect(viewport.scrollLeft).toBeCloseTo(86.25);
    expect(viewport.scrollTop).toBeCloseTo(30);
    controller.zoomOut();
    expect(diagramSize(viewport)).toEqual({ width: 300, height: 150 });
    expect(viewport.scrollLeft).toBeCloseTo(45);
    expect(viewport.scrollTop).toBeCloseTo(10);
  });

  it("applies the same zoom limits to controls and resets with fit", () => {
    const { viewport, controller } = createViewport();
    for (let i = 0; i < 12; i++) controller.zoomIn();
    expect(diagramSize(viewport)).toEqual({ width: 960, height: 480 });
    for (let i = 0; i < 24; i++) controller.zoomOut();
    expect(diagramSize(viewport)).toEqual({ width: 60, height: 30 });
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    controller.fit();
    expect(diagramSize(viewport)).toEqual({ width: 240, height: 120 });
  });

  it("leaves ordinary scrolling and pinches outside the viewport untouched", () => {
    const { viewport } = createViewport();
    const outside = document.createElement("div");
    outside.append(viewport);
    expect(pinch(viewport, -40, false).defaultPrevented).toBe(false);
    expect(pinch(outside, -40).defaultPrevented).toBe(false);
    expect(diagramSize(viewport)).toEqual({ width: 240, height: 120 });
  });

  it("clamps the scale between 25% and 400%", () => {
    const { viewport } = createViewport();
    pinch(viewport, -1000);
    expect(diagramSize(viewport)).toEqual({ width: 960, height: 480 });
    pinch(viewport, -1000);
    expect(diagramSize(viewport)).toEqual({ width: 960, height: 480 });
    pinch(viewport, 1000);
    expect(diagramSize(viewport)).toEqual({ width: 60, height: 30 });
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
  });

  it.each([1, 2])("normalizes wheel deltas in mode %s", (deltaMode) => {
    const { viewport } = createViewport();
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        ctrlKey: true,
        deltaMode,
        deltaY: doubleScaleDelta / (deltaMode === 1 ? 16 : 140),
        cancelable: true,
      }),
    );
    expect(diagramSize(viewport)).toEqual({ width: 480, height: 240 });
  });

  it("handles Safari gestures relative to each gesture's starting scale", () => {
    const { viewport } = createViewport();
    expect(gesture(viewport, "gesturestart").defaultPrevented).toBe(true);
    expect(gesture(viewport, "gesturechange", 2).defaultPrevented).toBe(true);
    expect(diagramSize(viewport)).toEqual({ width: 480, height: 240 });
    gesture(viewport, "gesturechange", 3);
    expect(diagramSize(viewport)).toEqual({ width: 720, height: 360 });
    expect(gesture(viewport, "gestureend").defaultPrevented).toBe(true);
    gesture(viewport, "gesturestart");
    gesture(viewport, "gesturechange", 0.5);
    expect(diagramSize(viewport)).toEqual({ width: 360, height: 180 });
    gesture(viewport, "gestureend");
    expect(gesture(viewport, "gesturechange", 2).defaultPrevented).toBe(false);
  });

  it("avoids counting wheel events twice during a Safari gesture", () => {
    const { viewport } = createViewport();
    gesture(viewport, "gesturestart");
    gesture(viewport, "gesturechange", 2);
    expect(pinch(viewport, doubleScaleDelta).defaultPrevented).toBe(true);
    expect(diagramSize(viewport)).toEqual({ width: 480, height: 240 });
    gesture(viewport, "gestureend");
    pinch(viewport, -doubleScaleDelta);
    expect(diagramSize(viewport)).toEqual({ width: 240, height: 120 });
  });

  it("fits the whole diagram again and resets its scroll position", () => {
    const { viewport, controller } = createViewport();
    pinch(viewport, doubleScaleDelta);
    controller.fit();
    expect(diagramSize(viewport)).toEqual({ width: 240, height: 120 });
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    pinch(viewport, doubleScaleDelta);
    expect(diagramSize(viewport)).toEqual({ width: 480, height: 240 });
  });

  it("preserves zoom and the viewed center when the viewport resizes", () => {
    const { viewport, resize } = createViewport();
    pinch(viewport, doubleScaleDelta);
    viewport.scrollLeft = 180;
    viewport.scrollTop = 80;
    resize(320, 200);
    expect(diagramSize(viewport)).toEqual({ width: 640, height: 320 });
    expect(viewport.scrollLeft).toBeCloseTo(240);
    expect(viewport.scrollTop).toBeCloseTo(100);
  });

  it("refits an unzoomed diagram when the viewport resizes", () => {
    const { viewport, resize } = createViewport();
    resize(160, 200);
    expect(diagramSize(viewport)).toEqual({ width: 160, height: 80 });
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
  });

  it("observes viewport changes and cleans up after closing", () => {
    let notify: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function (callback: ResizeObserverCallback) {
        notify = callback;
        return { observe: vi.fn(), disconnect };
      }),
    );
    const { viewport, controller, resize } = createViewport();
    resize(320, 200, false);
    notify!([], {} as ResizeObserver);
    expect(diagramSize(viewport)).toEqual({ width: 320, height: 160 });
    controller.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(pinch(viewport, doubleScaleDelta).defaultPrevented).toBe(false);
    expect(gesture(viewport, "gesturestart").defaultPrevented).toBe(false);
    resize(160, 200);
    expect(diagramSize(viewport)).toEqual({ width: 320, height: 160 });
  });

  it("preserves the browser gesture when no rendered diagram is available", () => {
    const viewport = document.createElement("div");
    controllers.push(initializeMermaidPinchZoom(viewport));
    expect(pinch(viewport, -40).defaultPrevented).toBe(false);
    expect(gesture(viewport, "gesturestart").defaultPrevented).toBe(false);
  });
});
