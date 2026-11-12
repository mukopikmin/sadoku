import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "./domTestUtils";
import { queryHook } from "./hookTestUtils";
import { loadTableLayouts, saveTableLayout } from "../api/tableLayouts";
import { useTableLayouts } from "../hooks/useTableLayouts";

vi.mock("../api/tableLayouts", () => ({
  loadTableLayouts: vi.fn(),
  saveTableLayout: vi.fn(),
}));

const layout = {
  id: "table",
  startLine: 1,
  endLine: 3,
  columnCount: 2,
  columnWidths: [100, 200],
};
const markdown = "| A | B |\n| - | - |\n| x | y |";

describe("server table layout state", () => {
  it("loads persisted widths and updates the shared query after saving and resetting", async () => {
    vi.mocked(loadTableLayouts).mockResolvedValue([layout]);
    vi.mocked(saveTableLayout).mockImplementation(
      async (_id, _markdown, _tableId, columnWidths) => ({
        ...layout,
        columnWidths,
      }),
    );
    const { wrapper } = queryHook();
    const { result } = renderHook(() => useTableLayouts(12, markdown), {
      wrapper,
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(loadTableLayouts).toHaveBeenCalledWith(12, markdown, [
      { startLine: 1, endLine: 3, columnCount: 2 },
    ]);
    await act(() => result.current.save("table", [150, 200]));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "ready",
        tables: [{ ...layout, columnWidths: [150, 200] }],
      }),
    );
    await act(() => result.current.save("table", []));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "ready",
        tables: [{ ...layout, columnWidths: [] }],
      }),
    );
  });

  it("reconciles again when revisiting a cached document revision", async () => {
    vi.mocked(loadTableLayouts).mockResolvedValue([layout]);
    const { wrapper } = queryHook();
    const { result, rerender } = renderHook(
      ({ text }) => useTableLayouts(12, text),
      { wrapper, initialProps: { text: markdown } },
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    rerender({ text: markdown + "\nEdited" });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const calls = vi.mocked(loadTableLayouts).mock.calls.length;
    rerender({ text: markdown });
    await waitFor(() =>
      expect(loadTableLayouts).toHaveBeenCalledTimes(calls + 1),
    );
  });

  it("keeps load failures visible and retries", async () => {
    vi.mocked(loadTableLayouts)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue([layout]);
    const { wrapper } = queryHook();
    const { result } = renderHook(() => useTableLayouts(12, markdown), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "error",
        message: "Offline",
      }),
    );
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
  });
});
