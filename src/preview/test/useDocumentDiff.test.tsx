import { describe, expect, it } from "vitest";
import { useDocumentDiff } from "../hooks/useDocumentDiff";
import { act, renderHook } from "./testUtils";

describe("useDocumentDiff", () => {
  it("starts off, accepts an empty baseline, and compares new content after reload", () => {
    const { result, rerender } = renderHook(
      ({
        id,
        markdown,
        previous,
      }: {
        id: number;
        markdown: string;
        previous?: string;
      }) => useDocumentDiff(id, markdown, previous),
      {
        initialProps: { id: 1, markdown: "New", previous: "" },
      },
    );
    expect(result.current.enabled).toBe(false);
    expect(result.current.available).toBe(true);
    expect(result.current.changes).toBeUndefined();
    act(() => result.current.onToggle());
    expect(result.current.changes?.current.size).toBe(1);
    rerender({ id: 1, markdown: "New\nMore", previous: "" });
    expect(result.current.changes?.current.size).toBe(2);
    rerender({ id: 2, markdown: "Other", previous: "Before" });
    expect(result.current.enabled).toBe(false);
    expect(result.current.changes).toBeUndefined();
  });

  it("does not compare without a baseline and supports switching off", () => {
    const { result, rerender } = renderHook(
      ({ previous }: { previous?: string }) =>
        useDocumentDiff(1, "New", previous),
      { initialProps: { previous: undefined as string | undefined } },
    );
    expect(result.current.available).toBe(false);
    act(() => result.current.onToggle());
    expect(result.current.enabled).toBe(false);
    rerender({ previous: "Old" });
    expect(result.current.enabled).toBe(false);
    act(() => result.current.onToggle());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.onToggle());
    expect(result.current.enabled).toBe(false);
  });
});
