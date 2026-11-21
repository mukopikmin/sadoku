import { afterEach, expect, it, vi } from "vitest";
import { useExpandableSource } from "../hooks/useExpandableSource";
import { initializeMermaid } from "../markdown/mermaid";
import { act, cleanup, fireEvent, render } from "./domTestUtils";
vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("measures overflow, retains the collapse control when expanded and removes resize listeners", () => {
  let source!: ReturnType<typeof useExpandableSource>;
  const Harness = () => {
    source = useExpandableSource("diagram");
    return <div ref={source.contentRef} />;
  };
  const remove = vi.spyOn(window, "removeEventListener");
  const { container, unmount } = render(<Harness />);
  const element = container.firstElementChild!;
  Object.defineProperties(element, {
    scrollHeight: { value: 200, configurable: true },
    clientHeight: { value: 160, configurable: true },
  });
  fireEvent.resize(window);
  expect(source.state).toEqual({ status: "collapsed", canExpand: true });
  act(() => source.toggle());
  expect(source.state.status).toBe("expanded");
  act(() => source.toggle());
  expect(source.state).toEqual({ status: "collapsed", canExpand: true });
  Object.defineProperty(element, "scrollHeight", { value: 100 });
  fireEvent.resize(window);
  expect(source.state).toEqual({ status: "collapsed", canExpand: false });
  expect(initializeMermaid).toHaveBeenCalledWith(
    expect.objectContaining({ root: element }),
  );
  unmount();
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
});
