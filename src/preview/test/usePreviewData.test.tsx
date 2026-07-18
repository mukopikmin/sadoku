import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewComment } from "../api/comments";
import {
  commentsQueryKey,
  useCommentActions,
  useCommentsQuery,
} from "../hooks/usePreviewData";
import { createPreviewQueryClient } from "../queryClient";
import { act, cleanup, renderHook, waitFor } from "./testUtils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const createComment = (
  overrides: Partial<PreviewComment> = {},
): PreviewComment => ({
  body: "Original comment.",
  createdAt: "2026-06-05T00:00:00.000Z",
  endLine: 3,
  id: 1,
  originalEndLine: 3,
  originalStartLine: 3,
  resolved: false,
  stale: false,
  startLine: 3,
  updatedAt: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

describe("preview data queries", () => {
  it("shares one comments request across query consumers", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(Response.json({
        comments: [],
        filePath: "/tmp/example.md",
      }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = createPreviewQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const first = renderHook(useCommentsQuery, { wrapper });
    const second = renderHook(useCommentsQuery, { wrapper });

    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true);
      expect(second.result.current.isSuccess).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updates the shared comments cache from mutation responses", async () => {
    const queryClient = createPreviewQueryClient();
    queryClient.setQueryData(commentsQueryKey, {
      comments: [createComment()],
      filePath: "/tmp/example.md",
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/__sadoku/comments" && init?.method === "POST") {
          return Promise.resolve(Response.json(createComment({ id: 2 })));
        }
        if (url === "/__sadoku/comments/1" && init?.method === "PUT") {
          return Promise.resolve(Response.json(createComment({
            body: "Updated comment.",
          })));
        }
        if (url === "/__sadoku/comments/1" && init?.method === "DELETE") {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );
    const { result } = renderHook(useCommentActions, { wrapper });

    await act(() => result.current.onCreateComment(3, "New comment.", 3));
    expect(
      queryClient.getQueryData<{ comments: PreviewComment[] }>(
        commentsQueryKey,
      )?.comments.map((comment) => comment.id),
    ).toEqual([1, 2]);

    await act(() => result.current.onUpdateComment(1, "Updated comment."));
    expect(
      queryClient.getQueryData<{ comments: PreviewComment[] }>(
        commentsQueryKey,
      )?.comments[0].body,
    ).toBe("Updated comment.");

    await act(() => result.current.onDeleteComment(1));
    expect(
      queryClient.getQueryData<{ comments: PreviewComment[] }>(
        commentsQueryKey,
      )?.comments.map((comment) => comment.id),
    ).toEqual([2]);
  });

  it("leaves cached comments unchanged when a mutation fails", async () => {
    const comment = createComment();
    const queryClient = createPreviewQueryClient();
    queryClient.setQueryData(commentsQueryKey, {
      comments: [comment],
      filePath: "/tmp/example.md",
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("Failed.", { status: 500 }))),
    );
    const { result } = renderHook(useCommentActions, { wrapper });

    await expect(
      act(() => result.current.onUpdateComment(1, "Rejected update.")),
    ).rejects.toThrow("Failed to update comment: 500");
    expect(
      queryClient.getQueryData<{ comments: PreviewComment[] }>(
        commentsQueryKey,
      )?.comments,
    ).toEqual([comment]);
  });
});
