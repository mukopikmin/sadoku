/// <reference types="node" />

import { Blob as NodeBlob } from "node:buffer";
import { cleanup as testingLibraryCleanup } from "@testing-library/react";

// Shiki's WASM loader needs Blob.stream(), which JSDOM does not implement.
Object.defineProperty(globalThis, "Blob", {
  value: NodeBlob,
  configurable: true,
  writable: true,
});

// JSDOM resolves animation styles but does not run animations or emit their
// completion events. Let Chakra finish presence transitions immediately.
Element.prototype.getAnimations ??= () => [];

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver ??= TestResizeObserver;

// JSDOM does not implement element scrolling used by Chakra's Select menu.
HTMLElement.prototype.scrollTo ??= function (
  options?: ScrollToOptions | number,
  y?: number,
) {
  if (typeof options === "number") {
    this.scrollLeft = options;
    this.scrollTop = y ?? 0;
  } else {
    this.scrollLeft = options?.left ?? this.scrollLeft;
    this.scrollTop = options?.top ?? this.scrollTop;
  }
};

export const cleanup = () => {
  testingLibraryCleanup();
  globalThis.history.replaceState(null, "", "/");
};

export {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
