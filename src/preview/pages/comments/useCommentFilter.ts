import { useState } from "react";
import { type Comment } from "../../models/comment";

export type CommentFilter = Comment["state"];

export const useCommentFilter = (comments: Comment[]) => {
  const [filter, setFilter] = useState<CommentFilter | null>(null);
  const filters = {
    active: {
      label: "Active",
      comments: comments.filter((comment) => comment.state === "active"),
      emptyText: "No active unresolved comments.",
    },
    stale: {
      label: "Stale",
      comments: comments.filter((comment) => comment.state === "stale"),
      emptyText: "No stale unresolved comments.",
    },
    resolved: {
      label: "Resolved",
      comments: comments.filter((comment) => comment.state === "resolved"),
      emptyText: "No resolved comments.",
    },
  };

  return {
    filter,
    setFilter,
    filters,
    totalCount: comments.length,
    visibleComments: filter === null ? comments : filters[filter].comments,
    emptyText: filter === null ? "No comments." : filters[filter].emptyText,
  };
};
