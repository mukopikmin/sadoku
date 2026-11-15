import { afterEach, expect, it, vi } from "vitest";
import { useExpandableSource } from "../hooks/useExpandableSource";
import { useNestedDialog } from "../hooks/useNestedDialog";
import { useMermaidDiagram } from "../markdown/useMermaidZoom";
import { initializeMermaid } from "../markdown/mermaid";
import { act, cleanup, fireEvent, render, renderHook } from "./domTestUtils";
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

it("allows Mermaid zoom only after an SVG has rendered", () => {
  let diagram!: ReturnType<typeof useMermaidDiagram>;
  const Harness = () => {
    diagram = useMermaidDiagram();
    return <pre ref={diagram.sourceRef} />;
  };
  const { container } = render(<Harness />);
  act(() => diagram.setOpen(true));
  expect(diagram.state.status).toBe("closed");
  container.firstElementChild!.appendChild(
    document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  );
  act(() => diagram.setOpen(true));
  expect(diagram.state.status).toBe("open");
  act(() => diagram.setOpen(false));
  expect(diagram.state.status).toBe("closed");
});

it("resets a nested dialog when its parent closes", () => {
  const { result, rerender } = renderHook(({ open }) => useNestedDialog(open), {
    initialProps: { open: true },
  });
  act(() => result.current.setOpen(true));
  expect(result.current.state.status).toBe("open");
  rerender({ open: false });
  expect(result.current.state.status).toBe("closed");
  act(() => result.current.setOpen(true));
  expect(result.current.state.status).toBe("closed");
  rerender({ open: true });
  expect(result.current.state.status).toBe("closed");
});
