import { afterEach, expect, it, vi } from "vitest";
import { createDocument } from "../api/document";
import { useDocumentCreator } from "../hooks/useDocumentCreator";
import { documentsQueryKey } from "../hooks/previewQueryKeys";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { deferred, queryHook } from "./hookTestUtils";
vi.mock("../api/document", () => ({ createDocument: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const created = {
  id: 3,
  relativePath: "docs/new.md",
  title: "new.md",
  tags: [],
  deleted: false,
};

it("rejects an empty filename and blocks duplicate submissions and edits until completion", async () => {
  const request = deferred<typeof created>();
  vi.mocked(createDocument).mockReturnValue(request.promise);
  const onCreated = vi.fn();
  const { client, wrapper } = queryHook();
  client.setQueryData(documentsQueryKey, [
    { ...created, id: 1, relativePath: "z.md" },
  ]);
  const { result } = renderHook(() => useDocumentCreator(onCreated), {
    wrapper,
  });
  act(() => result.current.open("docs"));
  await act(() => result.current.save());
  expect(createDocument).not.toHaveBeenCalled();
  act(() => result.current.change("filename", "new"));
  expect(result.current.state).toMatchObject({ relativePath: "docs/new.md" });
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.save();
    void result.current.save();
    result.current.close();
    result.current.open("other");
    result.current.change("filename", "overwrite");
  });
  expect(result.current.state).toMatchObject({
    status: "saving",
    input: { filename: "new", directory: "docs" },
  });
  await waitFor(() => expect(createDocument).toHaveBeenCalledOnce());
  await act(async () => {
    request.resolve(created);
    await completion;
  });
  expect(result.current.state.status).toBe("closed");
  expect(onCreated).toHaveBeenCalledWith(3);
  expect(client.getQueryData(documentsQueryKey)).toEqual([
    created,
    { ...created, id: 1, relativePath: "z.md" },
  ]);
});

it("preserves both fields on conflict and resets them for the next folder", async () => {
  vi.mocked(createDocument)
    .mockRejectedValueOnce(new Error("Already exists"))
    .mockResolvedValue(created);
  const { result } = renderHook(() => useDocumentCreator(vi.fn()), queryHook());
  act(() => result.current.open("docs"));
  act(() => result.current.change("filename", "new.md"));
  act(() => result.current.change("title", "Title"));
  await act(() => result.current.save());
  expect(result.current.state).toMatchObject({
    status: "error",
    message: "Already exists",
    input: { filename: "new.md", title: "Title" },
  });
  act(() => result.current.change("filename", "different.md"));
  expect(result.current.state.status).toBe("editing");
  await act(() => result.current.save());
  act(() => result.current.open("next"));
  expect(result.current.state).toMatchObject({
    status: "editing",
    input: { directory: "next", filename: "", title: "" },
  });
});
