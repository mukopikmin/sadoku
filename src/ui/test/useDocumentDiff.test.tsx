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
    expect(result.current.state.status).not.toBe("on");
    expect(result.current.state.status).toBe("off");
    expect(result.current.state).not.toHaveProperty("changes");
    act(() => result.current.onToggle());
    expect(result.current.state).toMatchObject({
      status: "on",
      changes: { current: new Set([1]) },
    });
    rerender({ id: 1, markdown: "New\nMore", previous: "" });
    expect(result.current.state).toMatchObject({
      status: "on",
      changes: { current: new Set([1, 2]) },
    });
    rerender({ id: 2, markdown: "Other", previous: "Before" });
    expect(result.current.state.status).not.toBe("on");
    expect(result.current.state).not.toHaveProperty("changes");
  });

  it("does not compare without a baseline and supports switching off", () => {
    const { result, rerender } = renderHook(
      ({ previous }: { previous?: string }) =>
        useDocumentDiff(1, "New", previous),
      { initialProps: { previous: undefined as string | undefined } },
    );
    expect(result.current.state.status).toBe("unavailable");
    act(() => result.current.onToggle());
    expect(result.current.state.status).not.toBe("on");
    rerender({ previous: "Old" });
    expect(result.current.state.status).not.toBe("on");
    act(() => result.current.onToggle());
    expect(result.current.state.status).toBe("on");
    act(() => result.current.onToggle());
    expect(result.current.state.status).not.toBe("on");
  });
});
