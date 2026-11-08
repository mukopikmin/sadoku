import { useRef, useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import type {
  Comment,
  ResolvedComment,
  UnresolvedComment,
} from "../../models/comment";
import { useCommentBulkActions } from "./useCommentBulkActions";
import { type CommentFilter, useCommentFilter } from "./useCommentFilter";
export type CommentDisplayCategory = "unresolved" | "resolved";
export const useCommentList = (
  comments: Comment[],
  actions: CommentActions,
) => {
  const [selectedCategory, setSelectedCategory] =
    useState<CommentDisplayCategory>("unresolved");
  const commentFilter = useCommentFilter(comments);
  const sections: Record<
    CommentDisplayCategory,
    {
      comments: UnresolvedComment[] | ResolvedComment[];
      count: number;
      emptyText: string;
      label: string;
    }
  > = {
    unresolved: {
      comments: commentFilter.visibleComments,
      count: commentFilter.unresolvedCount,
      emptyText: commentFilter.emptyText,
      label: "Unresolved",
    },
    resolved: {
      comments: commentFilter.resolvedComments,
      count: commentFilter.resolvedComments.length,
      emptyText: "No resolved comments.",
      label: "Resolved",
    },
  };
  const categories = Object.keys(sections) as CommentDisplayCategory[];
  const selectedSection = sections[selectedCategory];
  const bulk = useCommentBulkActions(selectedSection.comments, actions);
  const deleting = useRef(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const selectCategory = (category: CommentDisplayCategory) => {
    if (deleting.current || bulk.isPending || isDeleteDialogOpen) return;
    if (category === selectedCategory) return;
    bulk.clearSelection();
    setSelectedCategory(category);
  };
  const selectFilter = (filter: CommentFilter) => {
    if (deleting.current || bulk.isPending || isDeleteDialogOpen) return;
    if (filter === commentFilter.filter) return;
    bulk.clearSelection();
    commentFilter.setFilter(filter);
  };
  const selectAdjacentCategory = (
    category: CommentDisplayCategory,
    direction: -1 | 1,
    tabList: HTMLElement,
  ) => {
    const index = categories.indexOf(category);
    const nextCategory =
      categories[(index + direction + categories.length) % categories.length];
    selectCategory(nextCategory);
    tabList
      .querySelector<HTMLElement>(`[data-value="${nextCategory}"]`)
      ?.focus();
  };

  return {
    selectedCategory,
    commentFilter,
    sections,
    categories,
    selectedSection,
    bulk,
    deletion: {
      status: isDeleteDialogOpen
        ? bulk.isPending
          ? ("deleting" as const)
          : ("confirming" as const)
        : ("closed" as const),
    },
    selectCategory,
    selectFilter,
    selectAdjacentCategory,
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
