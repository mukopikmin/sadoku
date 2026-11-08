import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { createPreviewQueryClient } from "../queryClient";
import { useDocumentRestore } from "../hooks/useDocumentRestore";
import { restoreDocumentRevision } from "../api/documentRevisions";
import {
  commentsQueryKey,
  documentRevisionsQueryKey,
  documentsQueryKey,
  previewDocumentQueryKey,
} from "../hooks/previewQueryKeys";

vi.mock("../api/documentRevisions", () => ({
  restoreDocumentRevision: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("captures the confirmed revision and refreshes document, history and comments after success", async () => {
  const client = createPreviewQueryClient();
  const keys = [
    previewDocumentQueryKey(7),
    documentsQueryKey,
    documentRevisionsQueryKey(7),
    commentsQueryKey(7),
  ];
  for (const key of keys) client.setQueryData(key, "cached");
  client.setQueryData(previewDocumentQueryKey(8), "other document");
  const onRestored = vi.fn();
  let finish!: () => void;
  vi.mocked(restoreDocumentRevision).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDocumentRestore(7, onRestored), {
    wrapper,
  });
  act(() => result.current.request(3, ""));
  expect(restoreDocumentRevision).not.toHaveBeenCalled();
  act(() => {
    void result.current.confirm();
  });
  await waitFor(() => expect(result.current.state.status).toBe("restoring"));
  act(() => result.current.cancel());
  expect(result.current.state.status).toBe("restoring");
  expect(onRestored).not.toHaveBeenCalled();
  expect(restoreDocumentRevision).toHaveBeenCalledWith(7, 3, "");
  await act(async () => finish());
  await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
  expect(result.current.state.status).toBe("closed");
  for (const key of keys) {
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  }
  expect(client.getQueryState(previewDocumentQueryKey(8))?.isInvalidated).toBe(
    false,
  );
});

it("keeps restoration failures retryable and rejects replacement requests while restoring", async () => {
  vi.mocked(restoreDocumentRevision)
    .mockRejectedValueOnce(new Error("File changed"))
    .mockResolvedValue(undefined);
  const client = createPreviewQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const restored = vi.fn();
  const { result } = renderHook(() => useDocumentRestore(7, restored), {
    wrapper,
  });
  act(() => result.current.request(2, "Expected"));
  await act(() => result.current.confirm());
  expect(result.current.state).toEqual({
    status: "error",
    input: { revisionId: 2, expectedMarkdown: "Expected" },
    message: "File changed",
  });
  expect(restored).not.toHaveBeenCalled();
  let completion!: Promise<void>;
  act(() => {
    completion = result.current.confirm();
    void result.current.confirm();
    result.current.request(3, "Other");
    result.current.cancel();
  });
  expect(result.current.state).toMatchObject({
    status: "restoring",
    input: { revisionId: 2 },
  });
  await act(() => completion);
  expect(restoreDocumentRevision).toHaveBeenCalledTimes(2);
  expect(restoreDocumentRevision).toHaveBeenLastCalledWith(7, 2, "Expected");
  expect(restored).toHaveBeenCalledOnce();
});
