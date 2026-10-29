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

describe("tag hooks", () => {
  it.each([
    {
      name: "update-all",
      useAction: () => {
        const mutation = useUpdateTag();
        return async () => {
          await mutation.mutateAsync(tag);
        };
      },
      response: () => Response.json(tag),
      previewKey: ["preview-document"],
    },
    {
      name: "replace-document-42",
      useAction: () => {
        const mutation = useTagActions(42);
        return async () => {
          await mutation.replace([{ id: tag.id }]);
        };
      },
      response: () => Response.json([tag]),
      previewKey: previewDocumentQueryKey(42),
    },
    {
      name: "delete-all",
      useAction: () => {
        const mutation = useDeleteTag();
        return async () => {
          await mutation.mutateAsync(7);
        };
      },
      response: () => new Response(null, { status: 204 }),
      previewKey: ["preview-document"],
    },
  ])(
    "refreshes dependent caches only after successful $name",
    async ({ name, useAction, response, previewKey }) => {
      const fetchMock = vi.fn(async () => response());
      vi.stubGlobal("fetch", fetchMock);
      const queryClient = createPreviewQueryClient();
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      const { result } = renderHook(useAction, { wrapper });

      await act(() => result.current());

      expect(invalidate).toHaveBeenCalledWith({ queryKey: tagsQueryKey });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: documentsQueryKey });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: previewKey });
      if (name === "delete-all") {
        expect(fetchMock).toHaveBeenCalledWith("/__sadoku/tags/7", {
          method: "DELETE",
        });
        invalidate.mockClear();
        fetchMock.mockImplementation(async () =>
          new Response("Could not delete tag.", { status: 500 })
        );
        await act(async () => {
          await expect(result.current()).rejects.toThrow(
            "Could not delete tag.",
          );
        });
        expect(invalidate).not.toHaveBeenCalled();
      }
    },
  );
});
