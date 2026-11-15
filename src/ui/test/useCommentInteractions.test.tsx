import { useCommentMenu } from "../components/comments/useCommentMenu";
import { useCommentResolution } from "../components/comments/useCommentResolution";
import { afterEach, expect, it, vi } from "vitest";
import { useCommentActionState } from "../components/comments/useCommentActionState";
import { useReplyItem } from "../components/comments/useReplyItem";
import { useCommentDraft } from "../components/comments/useCommentDraft";
import { createComment, createCommentReply } from "./commentFixtures";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { toaster } from "../components/ui/toaster";
vi.mock("../components/ui/toaster", () => ({ toaster: { create: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("keeps an unsuccessful reply draft and reports the shared error, then closes after retry", async () => {
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue(undefined);
  const { result } = renderHook(() => {
    const action = useCommentActionState();
    const editor = useCommentDraft({
      initiallyOpen: false,
      commentId: 1,
      disabled: action.state.status === "pending",
      onSubmit: submit,
      runAction: action.runAction,
      errorTitle: "Could not add reply",
    });
    return { action, editor };
  });
  act(() => result.current.editor.open(" Reply "));
  await act(() => result.current.editor.save());
  expect(result.current.editor.state).toEqual({
    status: "editing",
    draft: " Reply ",
  });
  expect(result.current.action.state).toEqual({
    status: "error",
    message: "Offline",
  });
  expect(toaster.create).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Could not add reply",
      description: "Offline",
    }),
  );
  await act(() => result.current.editor.save());
  expect(submit).toHaveBeenLastCalledWith("Reply");
  expect(result.current.editor.state.status).toBe("closed");
});

it("restores saved reply text on cancel/reopen and keeps delete confirmation on failure", async () => {
  const remove = vi
    .fn()
    .mockRejectedValueOnce(new Error("Delete failed"))
    .mockResolvedValue(undefined);
  const update = vi.fn(async () => {});
  const reply = createCommentReply();
  const { result } = renderHook(() => {
    const action = useCommentActionState();
    const item = useReplyItem({
      commentId: 7,
      disabled: action.state.status === "pending",
      reply,
      onDelete: remove,
      onUpdate: update,
      reportError: action.reportError,
      runAction: action.runAction,
    });
    return { item, action };
  });
  act(() => result.current.item.edit());
  act(() => result.current.item.change("Unsaved"));
  act(() => result.current.item.cancelEdit());
  act(() => result.current.item.edit());
  expect(result.current.item.state).toEqual({
    status: "editing",
    draft: reply.body,
  });
  act(() => result.current.item.setDeleteOpen(true));
  await act(() => result.current.item.confirmDelete());
  expect(result.current.item.state.status).toBe("confirming-delete");
  expect(result.current.action.state).toMatchObject({
    status: "error",
    message: "Delete failed",
  });
  await act(() => result.current.item.confirmDelete());
  expect(result.current.item.state.status).toBe("reading");
  expect(remove).toHaveBeenCalledWith(7, reply.id);
});

it("copies reply content and reports clipboard rejection without changing the editor", async () => {
  const write = vi
    .fn()
    .mockRejectedValueOnce(new Error("Denied"))
    .mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: write } });
  const { result } = renderHook(() => {
    const action = useCommentActionState();
    const item = useReplyItem({
      commentId: 7,
      disabled: false,
      reply: createCommentReply(),
      onDelete: vi.fn(),
      onUpdate: vi.fn(),
      reportError: action.reportError,
      runAction: action.runAction,
    });
    return { item, action };
  });
  await act(() => result.current.item.copy());
  expect(result.current.action.state).toMatchObject({
    status: "error",
    message: "Denied",
  });
  expect(result.current.item.state.status).toBe("reading");
  await act(() => result.current.item.copy());
  expect(write).toHaveBeenLastCalledWith("Reply body.");
  expect(toaster.create).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: "Reply copied", type: "success" }),
  );
});

it("resolves a comment and wires Undo through the same shared action handler", async () => {
  const resolve = vi.fn(async () => {});
  const reopen = vi.fn(async () => {});
  const { result } = renderHook(() => {
    const action = useCommentActionState();
    return useCommentResolution({
      comment: createComment(),
      disabled: action.state.status === "pending",
      onReopen: reopen,
      onResolve: resolve,
      runAction: action.runAction,
    });
  });
  await act(() => result.current.run());
  expect(resolve).toHaveBeenCalledWith(1);
  const notification = vi.mocked(toaster.create).mock.calls.at(-1)![0];
  expect(notification).toMatchObject({
    title: "Comment resolved",
    action: { label: "Undo" },
  });
  act(() => {
    notification.action!.onClick();
  });
  await waitFor(() => expect(reopen).toHaveBeenCalledWith(1));
});

it("guards GitHub export eligibility, preserves export failures for retry, and requires delete confirmation", async () => {
  const exportComment = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue({ state: "pending", url: "https://github.com/review" });
  const remove = vi
    .fn()
    .mockRejectedValueOnce(new Error("Delete failed"))
    .mockResolvedValue(undefined);
  const { result, rerender } = renderHook(
    ({ comment }) => {
      const action = useCommentActionState();
      const menu = useCommentMenu({
        comment,
        disabled: action.state.status === "pending",
        lineLabel: "Line 3",
        onDelete: remove,
        onExport: exportComment,
        onEdit: vi.fn(),
        reportError: action.reportError,
        runAction: action.runAction,
      });
      return { menu, action };
    },
    { initialProps: { comment: createComment({ author: { type: "bot" } }) } },
  );
  act(() => {
    void result.current.menu.exportToGitHub();
    void result.current.menu.remove();
  });
  expect(exportComment).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  rerender({ comment: createComment() });
  await act(() => result.current.menu.exportToGitHub());
  expect(result.current.action.state).toMatchObject({
    status: "error",
    message: "Offline",
  });
  expect(result.current.menu.exportState.status).toBe("idle");
  await act(() => result.current.menu.exportToGitHub());
  expect(result.current.menu.exportState).toMatchObject({
    status: "exported",
    result: { state: "pending" },
  });
  act(() => result.current.menu.setDeleteOpen(true));
  await act(() => result.current.menu.remove());
  expect(result.current.menu.state.status).toBe("confirming-delete");
  await act(() => result.current.menu.remove());
  expect(result.current.menu.state.status).toBe("idle");
});
