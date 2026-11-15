import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as api from "../api/tags";
import { useDocumentTagEditor } from "../hooks/useDocumentTagEditor";
import { useTagsManager } from "../hooks/useTagsManager";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { deferred, queryHook } from "./hookTestUtils";
vi.mock("../api/tags", () => ({
  loadTags: vi.fn(),
  replaceDocumentTags: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));
const tag = {
  id: 1,
  name: "reviewed",
  backgroundColor: "#123456",
  documentCount: 1,
  createdAt: "created",
  updatedAt: "updated",
};
const empty: (typeof tag)[] = [];
beforeEach(() => vi.mocked(api.loadTags).mockResolvedValue([tag]));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("filters selected tags, offers creation and retains a failed draft for retry", async () => {
  vi.mocked(api.replaceDocumentTags)
    .mockRejectedValueOnce(new Error("Save failed"))
    .mockResolvedValue([tag]);
  const { result } = renderHook(
    () => useDocumentTagEditor(7, true, empty),
    queryHook(),
  );
  await waitFor(() => expect(result.current.list.status).toBe("ready"));
  act(() => result.current.change(" New "));
  expect(result.current.options).toContainEqual({
    value: "create",
    label: "Create “New”",
  });
  act(() => result.current.submit());
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "error",
      input: " New ",
      tags: [],
      message: "Save failed",
    }),
  );
  act(() => result.current.submit());
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "editing",
      input: "",
      tags: [tag],
    }),
  );
  expect(api.replaceDocumentTags).toHaveBeenLastCalledWith(7, [
    { name: "New" },
  ]);
  expect(result.current.options).toEqual([]);
});

it("rejects invalid, duplicate and over-limit tags without persistence", async () => {
  const { result, rerender } = renderHook(
    ({ tags }) => useDocumentTagEditor(7, true, tags),
    { ...queryHook(), initialProps: { tags: [tag] } },
  );
  await waitFor(() => expect(result.current.list.status).toBe("ready"));
  for (const [input, message] of [
    ["bad\nname", /control/],
    ["a".repeat(51), /50/],
    ["reviewed", /already/],
  ] as const) {
    act(() => result.current.change(input));
    act(() => result.current.submit());
    expect(result.current.state).toMatchObject({
      status: "error",
      message: expect.stringMatching(message),
    });
  }
  rerender({
    tags: Array.from({ length: 20 }, (_, id) => ({
      ...tag,
      id,
      name: `tag${id}`,
    })),
  });
  act(() => result.current.change("extra"));
  act(() => result.current.submit());
  expect(result.current.state).toMatchObject({
    status: "error",
    message: expect.stringContaining("20"),
  });
  expect(api.replaceDocumentTags).not.toHaveBeenCalled();
});

it("blocks duplicate additions and ignores a completion after changing document", async () => {
  const request = deferred<(typeof tag)[]>();
  vi.mocked(api.replaceDocumentTags).mockReturnValue(request.promise);
  const { result, rerender } = renderHook(
    ({ id }) => useDocumentTagEditor(id, true, empty),
    { ...queryHook(), initialProps: { id: 7 } },
  );
  await waitFor(() => expect(result.current.list.status).toBe("ready"));
  act(() => {
    result.current.add(tag);
    result.current.add(tag);
  });
  await waitFor(() => expect(api.replaceDocumentTags).toHaveBeenCalledOnce());
  expect(result.current.state.status).toBe("saving");
  rerender({ id: 8 });
  await act(async () => {
    request.resolve([tag]);
    await request.promise;
  });
  expect(result.current.state.tags).toEqual([]);
});

it("uses exact existing tags and preserves saved tags on failed removal", async () => {
  vi.mocked(api.replaceDocumentTags)
    .mockResolvedValueOnce([tag])
    .mockRejectedValueOnce(new Error("Removal failed"));
  const { result } = renderHook(
    () => useDocumentTagEditor(7, true, empty),
    queryHook(),
  );
  await waitFor(() => expect(result.current.list.status).toBe("ready"));
  act(() => result.current.change("reviewed"));
  act(() => result.current.submit());
  await waitFor(() => expect(result.current.state.tags).toEqual([tag]));
  expect(api.replaceDocumentTags).toHaveBeenCalledWith(7, [{ id: 1 }]);
  act(() => result.current.remove(tag));
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "error",
      tags: [tag],
    }),
  );
});

it("retains manager edits on conflict and serializes save/delete/cancel actions", async () => {
  vi.mocked(api.updateTag)
    .mockRejectedValueOnce(new Error("Conflict"))
    .mockResolvedValue(tag);
  const request = deferred<void>();
  vi.mocked(api.deleteTag).mockReturnValue(request.promise);
  const { result } = renderHook(() => useTagsManager(true), queryHook());
  act(() => result.current.edit(tag));
  act(() => result.current.change({ name: "Changed" }));
  await act(() => result.current.save());
  expect(result.current.state).toMatchObject({
    status: "edit-error",
    input: { name: "Changed" },
    message: "Conflict",
  });
  await act(() => result.current.save());
  expect(result.current.state.status).toBe("idle");
  act(() => result.current.requestDelete(1));
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.deleteSelected();
    void result.current.deleteSelected();
    result.current.cancel();
    result.current.edit(tag);
  });
  expect(result.current.state.status).toBe("deleting");
  await waitFor(() => expect(api.deleteTag).toHaveBeenCalledOnce());
  await act(async () => {
    request.resolve();
    await completion;
  });
  expect(result.current.state.status).toBe("idle");
});

it("keeps failed deletions retryable and clears state on closing", async () => {
  vi.mocked(api.deleteTag).mockRejectedValue(new Error("Delete failed"));
  const { result, rerender } = renderHook(({ open }) => useTagsManager(open), {
    ...queryHook(),
    initialProps: { open: true },
  });
  act(() => result.current.requestDelete(1));
  await act(() => result.current.deleteSelected());
  expect(result.current.state).toEqual({
    status: "delete-error",
    id: 1,
    message: "Delete failed",
  });
  rerender({ open: false });
  expect(result.current.state.status).toBe("idle");
});
