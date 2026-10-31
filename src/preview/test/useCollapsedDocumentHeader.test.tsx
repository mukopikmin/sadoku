import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollapsedDocumentHeader } from "../hooks/useCollapsedDocumentHeader";
import type { PreviewView } from "../models/previewView";
import { act, cleanup, fireEvent, render, screen } from "./domTestUtils";

let headerBottom: number;
let documentBottom: number;
let resize: () => void;
let frames: Map<number, FrameRequestCallback>;
const disconnect = vi.fn();

const rect = (bottom: number, height: number): DOMRect => ({
  bottom,
  top: bottom - height,
  height,
  left: 0,
  right: 800,
  width: 800,
  x: 0,
  y: bottom - height,
  toJSON: () => ({}),
});

const Harness = ({ documentId = 1, enabled = true, view = "preview" as PreviewView }) => {
  const { collapsed, documentHeaderRef, headerRef } = useCollapsedDocumentHeader(
    documentId,
    enabled,
    view,
  );
  return (
    <>
      <header ref={headerRef} />
      {enabled && <section ref={documentHeaderRef} />}
      <output>{collapsed ? "header" : "document"}</output>
    </>
  );
};

const flushFrames = () => act(() => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(0));
});

beforeEach(() => {
  headerBottom = 64;
  documentBottom = 180;
  frames = new Map();
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) {
      resize = callback;
    }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      return this.tagName === "HEADER"
        ? rect(headerBottom, headerBottom)
        : rect(documentBottom, 100);
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  disconnect.mockClear();
});

describe("useCollapsedDocumentHeader", () => {
  it("moves into the header only after the entire title area is hidden and returns on scrolling up", () => {
    render(<Harness />);
    expect(screen.getByRole("status").textContent).toBe("document");

    documentBottom = 65;
    fireEvent.scroll(globalThis);
    flushFrames();
    expect(screen.getByRole("status").textContent).toBe("document");

    documentBottom = 64;
    fireEvent.scroll(globalThis);
    fireEvent.scroll(globalThis);
    expect(frames.size).toBe(1);
    flushFrames();
    expect(screen.getByRole("status").textContent).toBe("header");

    documentBottom = 150;
    fireEvent.scroll(globalThis);
    flushFrames();
    expect(screen.getByRole("status").textContent).toBe("document");
  });

  it("measures the initial scroll position and resets for document and view changes", () => {
    documentBottom = -20;
    const { rerender } = render(<Harness />);
    expect(screen.getByRole("status").textContent).toBe("header");

    documentBottom = 180;
    rerender(<Harness documentId={2} />);
    expect(screen.getByRole("status").textContent).toBe("document");

    documentBottom = 30;
    fireEvent.scroll(globalThis);
    flushFrames();
    expect(screen.getByRole("status").textContent).toBe("header");
    rerender(<Harness documentId={2} enabled={false} />);
    expect(screen.getByRole("status").textContent).toBe("document");
    rerender(<Harness documentId={2} />);
    expect(screen.getByRole("status").textContent).toBe("header");

    documentBottom = 180;
    rerender(<Harness documentId={2} view="comments" />);
    expect(screen.getByRole("status").textContent).toBe("document");

    documentBottom = 30;
    fireEvent.scroll(globalThis);
    flushFrames();
    expect(screen.getByRole("status").textContent).toBe("header");

    documentBottom = 180;
    rerender(<Harness documentId={2} />);
    expect(screen.getByRole("status").textContent).toBe("document");
  });

  it("remeasures header and title area size changes", () => {
    documentBottom = 80;
    render(<Harness />);
    headerBottom = 96;
    act(() => resize());
    flushFrames();
    expect(screen.getByRole("status").textContent).toBe("header");

    headerBottom = 64;
    fireEvent.resize(globalThis);
    flushFrames();
    expect(screen.getByRole("status").textContent).toBe("document");
  });

  it("cancels pending measurements and disconnects on unmount", () => {
    const { unmount } = render(<Harness />);
    fireEvent.scroll(globalThis);
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
    fireEvent.scroll(globalThis);
    expect(frames.size).toBe(0);
  });
});
