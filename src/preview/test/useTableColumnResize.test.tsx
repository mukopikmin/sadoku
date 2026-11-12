import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "./domTestUtils";
import { useTableColumnResize } from "../markdown/useTableColumnResize";
import { deferred } from "./hookTestUtils";
import type { KeyboardEvent, PointerEvent } from "react";
import type { TableLayout } from "../models/tableLayout";

const layout: TableLayout = {
  id: "table",
  startLine: 1,
  endLine: 3,
  columnCount: 3,
  columnWidths: [100, 200, 300],
};
const handle = () => {
  const table = document.createElement("table");
  const cell = table.insertRow().appendChild(document.createElement("th"));
  cell.getBoundingClientRect = () => ({ width: 100 }) as DOMRect;
  const button = cell.appendChild(document.createElement("button"));
  button.setPointerCapture = vi.fn();
  button.releasePointerCapture = vi.fn();
  return button;
};
const pointer = (target: HTMLElement, x: number, pointerId = 1) =>
  ({
    currentTarget: target,
    clientX: x,
    pointerId,
    button: 0,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  }) as unknown as PointerEvent<HTMLElement>;

describe("column resizing", () => {
  it("keeps dragging local, saves on release, and preserves the other indices", async () => {
    const save = vi.fn(async (_id, columnWidths) => ({
      ...layout,
      columnWidths,
    }));
    const target = handle();
    const { result } = renderHook(() => useTableColumnResize(layout, save));
    act(() =>
      result.current.handleProps(0).onPointerDown(pointer(target, 100)),
    );
    act(() =>
      result.current.handleProps(0).onPointerMove(pointer(target, 175)),
    );
    expect(result.current.widths).toEqual([175, 200, 300]);
    expect(save).not.toHaveBeenCalled();
    act(() => result.current.handleProps(0).onPointerUp(pointer(target, 180)));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("table", [180, 200, 300]),
    );
  });

  it("cancels a gesture without saving and clamps keyboard widths", async () => {
    const save = vi.fn(async (_id, columnWidths) => ({
      ...layout,
      columnWidths,
    }));
    const target = handle();
    const { result } = renderHook(() => useTableColumnResize(layout, save));
    act(() =>
      result.current.handleProps(0).onPointerDown(pointer(target, 100)),
    );
    act(() =>
      result.current.handleProps(0).onPointerMove(pointer(target, -200)),
    );
    expect(result.current.widths).toEqual([64, 200, 300]);
    act(() => result.current.handleProps(0).onPointerCancel());
    expect(result.current.widths).toEqual(layout.columnWidths);
    expect(save).not.toHaveBeenCalled();
    act(() =>
      result.current.handleProps(0).onKeyDown({
        ...pointer(target, 0),
        key: "ArrowLeft",
        shiftKey: true,
      } as unknown as KeyboardEvent<HTMLElement>),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("table", [64, 200, 300]),
    );
  });

  it("retains a failed draft for retry and resets all widths to automatic", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockImplementation(async (_id, columnWidths) => ({
        ...layout,
        columnWidths,
      }));
    const target = handle();
    const { result } = renderHook(() => useTableColumnResize(layout, save));
    act(() =>
      result.current.handleProps(1).onKeyDown({
        ...pointer(target, 0),
        key: "ArrowRight",
      } as unknown as KeyboardEvent<HTMLElement>),
    );
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "error",
        message: "Offline",
      }),
    );
    expect(result.current.widths).toEqual([100, 210, 300]);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("idle"));
    expect(save).toHaveBeenLastCalledWith("table", [100, 210, 300]);
    act(() => result.current.reset());
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("table", []));
  });

  it("does not discard a new drag when an earlier save completes", async () => {
    const pending = deferred<TableLayout>();
    const save = vi.fn(() => pending.promise);
    const target = handle();
    const { result } = renderHook(() => useTableColumnResize(layout, save));
    act(() => result.current.reset());
    act(() =>
      result.current.handleProps(0).onPointerDown(pointer(target, 100)),
    );
    act(() =>
      result.current.handleProps(0).onPointerMove(pointer(target, 180)),
    );
    await act(async () => pending.resolve({ ...layout, columnWidths: [] }));
    expect(result.current.widths).toEqual([180, 0, 0]);
  });
});
