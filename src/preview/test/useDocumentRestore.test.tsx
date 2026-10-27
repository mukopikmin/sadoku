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

vi.mock(
  "../api/documentRevisions",
  () => ({ restoreDocumentRevision: vi.fn() }),
);
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
  vi.mocked(restoreDocumentRevision).mockImplementation(() =>
    new Promise<void>((resolve) => {
      finish = resolve;
    })
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDocumentRestore(7, onRestored), {
    wrapper,
  });
  act(() => result.current.request(3, ""));
  expect(restoreDocumentRevision).not.toHaveBeenCalled();
  act(() => result.current.confirm());
  await waitFor(() => expect(result.current.isPending).toBe(true));
  act(() => result.current.cancel());
  expect(result.current.open).toBe(true);
  expect(onRestored).not.toHaveBeenCalled();
  expect(restoreDocumentRevision).toHaveBeenCalledWith(7, 3, "");
  await act(async () => finish());
  await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
  expect(result.current.open).toBe(false);
  for (const key of keys) {
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  }
  expect(client.getQueryState(previewDocumentQueryKey(8))?.isInvalidated).toBe(
    false,
  );
});
