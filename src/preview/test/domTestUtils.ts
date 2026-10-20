import { cleanup as testingLibraryCleanup } from "@testing-library/react";

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver ??= TestResizeObserver;

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
