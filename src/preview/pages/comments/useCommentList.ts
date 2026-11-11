import { useRef, useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import type { Comment } from "../../models/comment";
import { useCommentBulkActions } from "./useCommentBulkActions";
import { type CommentFilter, useCommentFilter } from "./useCommentFilter";
export const useCommentList = (
  comments: Comment[],
  actions: CommentActions,
) => {
  const commentFilter = useCommentFilter(comments);
  const bulk = useCommentBulkActions(commentFilter.visibleComments, actions);
  const selectedComments = commentFilter.visibleComments.filter((comment) =>
    bulk.selectedIds.includes(comment.id),
  );
  const deleting = useRef(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const selectFilter = (filter: CommentFilter) => {
    if (deleting.current || bulk.isPending || isDeleteDialogOpen) return;
    bulk.clearSelection();
    commentFilter.setFilter(commentFilter.filter === filter ? null : filter);
  };

  return {
    commentFilter,
    canResolve: selectedComments.some(
      (comment) => comment.state !== "resolved",
    ),
    canReopen: selectedComments.some((comment) => comment.state === "resolved"),
    bulk,
    deletion: {
      status: isDeleteDialogOpen
        ? bulk.isPending
          ? ("deleting" as const)
          : ("confirming" as const)
        : ("closed" as const),
    },
    selectFilter,
    setDeleteOpen: (open: boolean) => {
      if (!deleting.current && !bulk.isPending) setIsDeleteDialogOpen(open);
    },
    confirmDelete: async () => {
      if (!isDeleteDialogOpen || deleting.current || bulk.isPending) return;
      deleting.current = true;
      try {
        await bulk.run("delete");
        setIsDeleteDialogOpen(false);
      } finally {
        deleting.current = false;
      }
    },
  };
};
