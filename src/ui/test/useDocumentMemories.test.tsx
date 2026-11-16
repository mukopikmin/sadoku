import { afterEach, expect, it, vi } from "vitest";
import * as api from "../api/memories";
import { useDocumentMemories } from "../hooks/useDocumentMemories";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { deferred, queryHook } from "./hookTestUtils";
vi.mock("../api/memories", () => ({
  loadMemories: vi.fn(),
  deleteMemory: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const memory = {
  id: 1,
  documentId: 7,
  content: "Fact",
  createdAt: "created",
  updatedAt: "updated",
};

it("keeps failed deletions retryable, guards duplicate calls, and refreshes the list", async () => {
  let items = [memory];
  vi.mocked(api.loadMemories).mockImplementation(async () => items);
  vi.mocked(api.deleteMemory).mockRejectedValueOnce(new Error("Delete failed"));
  const { result } = renderHook(
    () => useDocumentMemories(7, true),
    queryHook(),
  );
  await waitFor(() => expect(result.current.list.status).toBe("ready"));
  act(() => result.current.requestDelete(memory));
  await act(() => result.current.remove());
  expect(result.current.state).toMatchObject({
    status: "error",
    memory,
    message: "Delete failed",
  });
  const request = deferred<void>();
  vi.mocked(api.deleteMemory).mockImplementationOnce(async () => {
    await request.promise;
    items = [];
  });
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.remove();
    void result.current.remove();
    result.current.cancel();
  });
  expect(result.current.state.status).toBe("deleting");
  await waitFor(() => expect(api.deleteMemory).toHaveBeenCalledTimes(2));
  await act(async () => {
    request.resolve();
    await completion;
  });
  await waitFor(() => expect(result.current.list.status).toBe("empty"));
  expect(result.current.state.status).toBe("idle");
});

it("clears confirmation on closing and ignores a late result for another document", async () => {
  vi.mocked(api.loadMemories).mockResolvedValue([memory]);
  const request = deferred<void>();
  vi.mocked(api.deleteMemory).mockReturnValue(request.promise);
  const { result, rerender } = renderHook(
    ({ id, open }) => useDocumentMemories(id, open),
    { ...queryHook(), initialProps: { id: 7, open: true } },
  );
  act(() => result.current.requestDelete(memory));
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.remove();
  });
  rerender({ id: 8, open: false });
  await act(async () => {
    request.reject(new Error("Old failure"));
    await completion;
  });
  expect(result.current.state.status).toBe("idle");
});
