import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  documentsQueryKey,
  previewDocumentQueryKey,
  tagsQueryKey,
} from "../hooks/previewQueryKeys";
import { useTagActions, useUpdateTag } from "../hooks/useTags";
import { createPreviewQueryClient } from "../queryClient";
import { act, cleanup, renderHook } from "./testUtils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tag = { backgroundColor: "#123456", id: 7, name: "reviewed" };

describe("tag hooks", () => {
  it("refreshes tags, documents, and every preview document after updating a tag", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json(tag))));
    const queryClient = createPreviewQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateTag(), { wrapper });

    await act(() => result.current.mutateAsync(tag));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagsQueryKey });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: documentsQueryKey });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["preview-document"],
    });
  });

  it("refreshes the selected document, document list, and tags after replacing document tags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json([tag]))),
    );
    const queryClient = createPreviewQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useTagActions(42), { wrapper });

    await act(() => result.current.replace([{ id: tag.id }]));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: tagsQueryKey });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: documentsQueryKey });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: previewDocumentQueryKey(42),
    });
  });
});
