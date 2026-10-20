import { useEffect, useRef, useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import type { Comment } from "../../models/comment";

type BulkOperation = "resolve" | "reopen" | "delete";
type BulkActionState =
  | { status: "idle" }
  | { status: "pending"; operation: BulkOperation }
  | { status: "error"; message: string };

export const useCommentBulkActions = (
  comments: Comment[],
  actions: CommentActions,
) => {
  const [selection, setSelection] = useState<number[]>([]);
  const [state, setState] = useState<BulkActionState>({ status: "idle" });
  const pending = useRef(false);
  const selectedIds = selection.filter((id) =>
    comments.some((comment) => comment.id === id)
  );

  useEffect(() => {
    setSelection((current) => {
      const remaining = current.filter((id) =>
        comments.some((comment) => comment.id === id)
      );
      return remaining.length === current.length ? current : remaining;
    });
  }, [comments]);

  const clearSelection = () => {
    if (pending.current) return;
    setSelection([]);
    setState({ status: "idle" });
  };

  const toggle = (id: number) => {
    if (pending.current) return;
    setSelection((current) =>
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id]
    );
  };

  const toggleAll = () => {
    if (pending.current) return;
    setSelection(
      selectedIds.length === comments.length
        ? []
        : comments.map((comment) => comment.id),
    );
  };

  const run = async (operation: BulkOperation) => {
    if (pending.current || selectedIds.length === 0) return false;
    pending.current = true;
    setState({ status: "pending", operation });
    const action = {
      resolve: actions.onResolveComment,
      reopen: actions.onReopenComment,
      delete: actions.onDeleteComment,
    }[operation];
    const failed: number[] = [];
    let firstError = "";
    // Each mutation may read and rewrite the document. Keep them sequential so
    // bulk changes cannot overwrite one another, and continue after failures.
    for (const id of selectedIds) {
      try {
        await action(id);
      } catch (error) {
        failed.push(id);
        firstError ||= error instanceof Error ? error.message : String(error);
      }
    }
    setSelection(failed);
    setState(
      failed.length === 0 ? { status: "idle" } : {
        status: "error",
        message:
          `Could not ${operation} ${failed.length} of ${selectedIds.length} selected comments. ${firstError}`,
      },
    );
    pending.current = false;
    return failed.length === 0;
  };

  return {
    clearSelection,
    isPending: state.status === "pending",
    run,
    selectedIds,
    state,
    toggle,
    toggleAll,
  };
};
