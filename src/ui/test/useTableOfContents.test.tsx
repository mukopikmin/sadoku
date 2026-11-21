import { afterEach, expect, it, vi } from "vitest";
import { useTableOfContents } from "../hooks/useTableOfContents";
import { act, cleanup, renderHook } from "./domTestUtils";

afterEach(cleanup);

it("exposes empty and ready states as headings change", () => {
  const { result, rerender } = renderHook(
    ({ markdown }) => useTableOfContents(markdown),
    { initialProps: { markdown: "No headings" } },
  );
  expect(result.current.state.status).toBe("empty");
  rerender({ markdown: "# Parent\n\n## Child" });
  const { state } = result.current;
  if (state.status !== "ready") throw new Error("Expected headings");
  expect(state.collection.rootNode.children[0]).toMatchObject({
    id: "parent",
    children: [{ id: "child" }],
  });
  expect(state.expandedValue).toEqual(["heading:parent", "heading:child"]);
  rerender({ markdown: "No headings again" });
  expect(result.current.state.status).toBe("empty");
});

it("ignores empty selection and closes after navigating to an encoded heading", () => {
  const { result } = renderHook(() => useTableOfContents("# 日本語"));
  act(() => result.current.setOpen(true));
  act(() => result.current.select([]));
  expect(result.current.open).toBe(true);
  expect(globalThis.location.hash).toBe("");
  const { state } = result.current;
  if (state.status !== "ready") throw new Error("Expected headings");
  act(() => result.current.select(state.collection.rootNode.children));
  expect(result.current.open).toBe(false);
  expect(globalThis.location.hash).toBe("#%E6%97%A5%E6%9C%AC%E8%AA%9E");
});

it("dispatches hashchange when selecting the current heading again", () => {
  globalThis.history.replaceState(null, "", "/#heading");
  const { result } = renderHook(() => useTableOfContents("# Heading"));
  const onHashChange = vi.fn();
  globalThis.addEventListener("hashchange", onHashChange);
  try {
    act(() => result.current.setOpen(true));
    const { state } = result.current;
    if (state.status !== "ready") throw new Error("Expected headings");
    act(() => result.current.select(state.collection.rootNode.children));
    expect(onHashChange).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
    expect(globalThis.location.hash).toBe("#heading");
  } finally {
    globalThis.removeEventListener("hashchange", onHashChange);
  }
});
