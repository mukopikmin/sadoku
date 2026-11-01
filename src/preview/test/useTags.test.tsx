import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  documentsQueryKey,
  previewDocumentQueryKey,
  tagsQueryKey,
} from "../hooks/previewQueryKeys";
import { useDeleteTag, useTagActions, useUpdateTag } from "../hooks/useTags";
import { createPreviewQueryClient } from "../queryClient";
import { act, cleanup, renderHook } from "./domTestUtils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tag = { backgroundColor: "#123456", id: 7, name: "reviewed" };
const keys = [
  tagsQueryKey,
  documentsQueryKey,
  previewDocumentQueryKey(42),
  previewDocumentQueryKey(8),
];

const setup = () => {
  const client = createPreviewQueryClient();
  for (const key of keys) client.setQueryData(key, "cached");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const invalidated = () =>
    keys.map((key) => client.getQueryState(key)?.isInvalidated);
  return { wrapper, invalidated };
};

describe("tag hooks", () => {
  it.each([
    {
      operation: "update",
      useAction: () => {
        const mutation = useUpdateTag();
        return () => mutation.mutateAsync(tag);
      },
      response: tag,
      allPreviews: true,
    },
    {
      operation: "replace",
      useAction: () => {
        const actions = useTagActions(42);
        return () => actions.replace([{ id: tag.id }]);
      },
      response: [tag],
      allPreviews: false,
    },
    {
      operation: "delete",
      useAction: () => {
        const mutation = useDeleteTag();
        return () => mutation.mutateAsync(tag.id);
      },
      response: undefined,
      allPreviews: true,
    },
  ])(
    "$operation invalidates tags, documents, and the affected previews",
    async ({ operation, useAction, response, allPreviews }) => {
      const fetchMock = vi.fn(async () =>
        response === undefined
          ? new Response(null, { status: 204 })
          : Response.json(response)
      );
      vi.stubGlobal("fetch", fetchMock);
      const { wrapper, invalidated } = setup();
      const { result } = renderHook<() => Promise<unknown>, unknown>(
        useAction,
        { wrapper },
      );

      await act(() => result.current());

      expect(invalidated()).toEqual([true, true, true, allPreviews]);
      if (operation === "delete") {
        expect(fetchMock).toHaveBeenCalledWith("/__sadoku/tags/7", {
          method: "DELETE",
        });
      }
    },
  );

  it("leaves every tag consumer valid when deletion fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Could not delete tag.", { status: 500 })),
    );
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useDeleteTag(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(tag.id)).rejects.toThrow(
        "Could not delete tag.",
      );
    });

    expect(invalidated()).toEqual([false, false, false, false]);
  });
});
