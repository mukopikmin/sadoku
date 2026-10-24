import { cleanup as testingLibraryCleanup } from "@testing-library/react";

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
