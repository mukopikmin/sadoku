import { afterEach, expect, it, vi } from "vitest";
import { updateDocumentTitle } from "../api/document";
import { useDocumentTitleEditor } from "../hooks/useDocumentTitleEditor";
import {
  documentsQueryKey,
  previewDocumentQueryKey,
} from "../hooks/previewQueryKeys";
import { act, cleanup, renderHook } from "./domTestUtils";
import { queryHook } from "./hookTestUtils";
vi.mock("../api/document", () => ({ updateDocumentTitle: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("retains failed title edits and refreshes document queries after explicitly clearing the title", async () => {
  vi.mocked(updateDocumentTitle)
    .mockRejectedValueOnce(new Error("Conflict"))
    .mockResolvedValue(undefined);
  const { client, wrapper } = queryHook();
  client.setQueryData(documentsQueryKey, []);
  client.setQueryData(previewDocumentQueryKey(7), {});
  const { result } = renderHook(() => useDocumentTitleEditor(7, "Original"), {
    wrapper,
  });
  act(() => result.current.open());
  act(() => result.current.change("New"));
  await act(() => result.current.save());
  expect(result.current.state).toMatchObject({
    status: "error",
    draft: "New",
    message: "Conflict",
  });
  act(() => result.current.change(""));
  await act(() => result.current.save());
  expect(updateDocumentTitle).toHaveBeenLastCalledWith(7, "");
  expect(result.current.state.status).toBe("closed");
  expect(client.getQueryState(documentsQueryKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(previewDocumentQueryKey(7))?.isInvalidated).toBe(
    true,
  );
});
