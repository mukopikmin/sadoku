import { loadPreviewDocument } from "../api/document";
import { toaster } from "../components/ui/toaster";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "./domTestUtils";
import { queryHook } from "./hookTestUtils";
import { loadTableLayouts, saveTableLayout } from "../api/tableLayouts";
import { useTableLayouts } from "../hooks/useTableLayouts";

vi.mock("../api/document", () => ({ loadPreviewDocument: vi.fn() }));
vi.mock("../api/tableLayouts", () => ({
  isTableLayoutConflict: (error: unknown) =>
    error instanceof Error && error.message === "conflict",
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

beforeEach(() => vi.clearAllMocks());

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
      }),
    );
    expect(toaster.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "error",
        description: "Offline",
        action: expect.objectContaining({ label: "Retry" }),
      }),
    );
    act(() =>
      vi.mocked(toaster.create).mock.calls.at(-1)![0].action!.onClick!(),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
  });
});

it("offers reload instead of retrying an obsolete document on initial layout load", async () => {
  vi.mocked(loadTableLayouts).mockRejectedValueOnce(new Error("conflict"));
  const { wrapper } = queryHook();
  const { result } = renderHook(() => useTableLayouts(12, markdown), {
    wrapper,
  });
  await waitFor(() => expect(result.current.state.status).toBe("error"));
  expect(toaster.create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      action: expect.objectContaining({ label: "Reload preview" }),
    }),
  );
});

describe("recovering table saves after document edits", () => {
  const latestMarkdown = "New paragraph\n\n" + markdown;
  const latestLayout = { ...layout, startLine: 3, endLine: 5 };
  beforeEach(() => {
    vi.mocked(loadPreviewDocument).mockResolvedValue({
      markdown: latestMarkdown,
      title: "doc",
      fileUrl: "file:///doc.md",
      deleted: false,
      tags: [],
    });
    vi.mocked(loadTableLayouts).mockImplementation(async (_id, text) =>
      text === markdown ? [layout] : [latestLayout],
    );
    vi.mocked(saveTableLayout).mockReset();
  });

  it("reconciles and retries the same table without reloading or moving the displayed table", async () => {
    vi.mocked(saveTableLayout)
      .mockRejectedValueOnce(new Error("conflict"))
      .mockResolvedValueOnce({ ...latestLayout, columnWidths: [150, 200] });
    const { wrapper } = queryHook();
    const { result } = renderHook(() => useTableLayouts(12, markdown), {
      wrapper,
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(() => result.current.save("table", [150, 200]));
    expect(saveTableLayout).toHaveBeenNthCalledWith(
      1,
      12,
      markdown,
      "table",
      [150, 200],
    );
    expect(saveTableLayout).toHaveBeenNthCalledWith(
      2,
      12,
      latestMarkdown,
      "table",
      [150, 200],
    );
    expect(loadTableLayouts).toHaveBeenLastCalledWith(12, latestMarkdown, [
      { startLine: 3, endLine: 5, columnCount: 2 },
    ]);
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "ready",
        tables: [{ ...layout, columnWidths: [150, 200] }],
      }),
    );
  });

  it("drops trailing widths if the identified table lost columns", async () => {
    const smaller = "New paragraph\n\n| A |\n| - |\n| x |";
    vi.mocked(loadPreviewDocument).mockResolvedValue({
      markdown: smaller,
      title: "doc",
      fileUrl: "file:///doc.md",
      deleted: false,
      tags: [],
    });
    vi.mocked(loadTableLayouts)
      .mockResolvedValueOnce([layout])
      .mockResolvedValueOnce([{ ...latestLayout, columnCount: 1 }]);
    vi.mocked(saveTableLayout)
      .mockRejectedValueOnce(new Error("conflict"))
      .mockResolvedValueOnce({
        ...latestLayout,
        columnCount: 1,
        columnWidths: [150],
      });
    const { wrapper } = queryHook();
    const { result } = renderHook(() => useTableLayouts(12, markdown), {
      wrapper,
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(() => result.current.save("table", [150, 200]));
    expect(saveTableLayout).toHaveBeenLastCalledWith(
      12,
      smaller,
      "table",
      [150],
    );
  });

  it("does not write to a replacement table when the original identity is lost", async () => {
    vi.mocked(loadTableLayouts)
      .mockResolvedValueOnce([layout])
      .mockResolvedValueOnce([{ ...latestLayout, id: "replacement" }]);
    vi.mocked(saveTableLayout).mockRejectedValueOnce(new Error("conflict"));
    const { wrapper } = queryHook();
    const { result } = renderHook(() => useTableLayouts(12, markdown), {
      wrapper,
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(async () => {
      await expect(result.current.save("table", [150, 200])).rejects.toThrow(
        "Reload the preview",
      );
    });
    expect(saveTableLayout).toHaveBeenCalledTimes(1);
  });

  it("does not reconcile unrelated failures or retry indefinitely during further edits", async () => {
    const { wrapper } = queryHook();
    vi.mocked(saveTableLayout).mockRejectedValue(new Error("Offline"));
    const { result } = renderHook(() => useTableLayouts(12, markdown), {
      wrapper,
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(async () => {
      await expect(result.current.save("table", [150, 200])).rejects.toThrow(
        "Offline",
      );
    });
    expect(loadPreviewDocument).not.toHaveBeenCalled();
    vi.mocked(saveTableLayout)
      .mockClear()
      .mockRejectedValue(new Error("conflict"));
    await act(async () => {
      await expect(result.current.save("table", [150, 200])).rejects.toThrow(
        "conflict",
      );
    });
    expect(saveTableLayout).toHaveBeenCalledTimes(2);
    expect(loadPreviewDocument).toHaveBeenCalledTimes(1);
  });
});

vi.mock("../components/ui/toaster", () => ({ toaster: { create: vi.fn() } }));
