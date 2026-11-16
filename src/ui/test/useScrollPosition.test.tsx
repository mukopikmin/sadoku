import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderHook } from "./domTestUtils";
import {
  clearScrollPositions,
  useScrollPosition,
  type ScrollView,
} from "../hooks/useScrollPosition";

let position = 0;
let nextFrame = 0;
let frames: Map<number, FrameRequestCallback>;
const flushFrames = () =>
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
const scroll = (top: number) =>
  act(() => {
    position = top;
    fireEvent.scroll(window);
  });

beforeEach(() => {
  clearScrollPositions();
  position = 0;
  frames = new Map();
  vi.stubGlobal("scrollY", 0);
  Object.defineProperty(globalThis, "scrollY", {
    configurable: true,
    get: () => position,
  });
  vi.stubGlobal(
    "scrollTo",
    vi.fn((options: ScrollToOptions) => {
      position = options.top ?? 0;
    }),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  clearScrollPositions();
});

it("preserves the last active scroll position when navigation clamps the outgoing page", () => {
  const { rerender } = renderHook(
    ({ view }: { view: ScrollView }) => useScrollPosition(1, view, true),
    {
      initialProps: { view: "preview" as ScrollView },
    },
  );
  flushFrames();
  scroll(900);
  // The browser shortens the page before effect cleanup during history traversal.
  position = 0;
  rerender({ view: "comments" });
  flushFrames();
  expect(position).toBe(0);
  scroll(340);
  position = 0;
  rerender({ view: "preview" });
  flushFrames();
  expect(position).toBe(900);
  scroll(1400);
  position = 0;
  rerender({ view: "comments" });
  flushFrames();
  expect(position).toBe(340);
  position = 0;
  rerender({ view: "preview" });
  flushFrames();
  expect(position).toBe(1400);
});

it("waits for content and cancels stale restoration frames on rapid navigation", () => {
  const { rerender } = renderHook(
    ({ view, ready }: { view: ScrollView; ready: boolean }) =>
      useScrollPosition(1, view, ready),
    {
      initialProps: { view: "preview" as ScrollView, ready: false },
    },
  );
  expect(frames.size).toBe(0);
  rerender({ view: "preview", ready: true });
  flushFrames();
  scroll(900);
  rerender({ view: "comments", ready: true });
  rerender({ view: "preview", ready: true });
  expect(frames.size).toBe(1);
  flushFrames();
  expect(position).toBe(900);
});

it("scrolls to the innermost target block instead of restoring the saved position", () => {
  document.body.innerHTML = `<header></header><div class="markdown-preview">
    <div class="commentable-block" data-source-line="1" data-source-end-line="10">
      <div class="commentable-block" data-source-line="3" data-source-end-line="5"></div>
    </div></div>`;
  const target = document.querySelector<HTMLElement>('[data-source-line="3"]');
  if (!target) throw new Error("Expected the target block");
  const scrollIntoView = vi.fn();
  target.scrollIntoView = scrollIntoView;
  const { rerender } = renderHook(
    ({ line }: { line?: number }) =>
      useScrollPosition(1, "preview", true, line),
    { initialProps: { line: undefined as number | undefined } },
  );
  flushFrames();
  scroll(900);
  rerender({ line: 4 });
  flushFrames();
  expect(scrollIntoView).toHaveBeenCalledWith({
    block: "start",
    behavior: "instant",
  });
});

it("falls back to restoration when the target is not rendered", () => {
  renderHook(() => useScrollPosition(1, "preview", true, 999));
  flushFrames();
  expect(globalThis.scrollTo).toHaveBeenCalledWith({
    top: 0,
    left: 0,
    behavior: "instant",
  });
});
