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
    fireEvent.scroll(globalThis);
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
