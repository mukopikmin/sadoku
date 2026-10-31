import { useState } from "react";
import { type Comment, isUnresolvedComment } from "../../models/comment";

export type CommentFilter = "all" | "active" | "stale";

export const useCommentFilter = (comments: Comment[]) => {
  const [filter, setFilter] = useState<CommentFilter>("all");
  const unresolvedComments = comments.filter(isUnresolvedComment);
  const resolvedComments = comments.filter(
    (comment) => comment.state === "resolved",
  );
  const activeComments = unresolvedComments.filter(
    (comment) => comment.state === "active",
  );
  const staleComments = unresolvedComments.filter(
    (comment) => comment.state === "stale",
  );
  const filters = {
    all: {
      label: "All",
      comments: unresolvedComments,
      emptyText: "No unresolved comments.",
    },
    active: {
      label: "Active",
      comments: activeComments,
      emptyText: "No active unresolved comments.",
    },
    stale: {
      label: "Stale",
      comments: staleComments,
      emptyText: "No stale unresolved comments.",
    },
  };

  return {
    filter,
    setFilter,
    filters,
    resolvedComments,
    unresolvedCount: unresolvedComments.length,
    visibleComments: filters[filter].comments,
    emptyText: filters[filter].emptyText,
  };
};
