import { useState } from "react";
import { type Comment } from "../../models/comment";

export type CommentFilter = Comment["state"];

export const useCommentFilter = (comments: Comment[]) => {
  const [selectedFilters, setSelectedFilters] = useState<CommentFilter[]>([
    "active",
    "stale",
  ]);
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
    selectedFilters,
    toggleFilter: (filter: CommentFilter) =>
      setSelectedFilters((current) =>
        current.includes(filter)
          ? current.filter((value) => value !== filter)
          : [...current, filter],
      ),
    filters,
    totalCount: comments.length,
    visibleComments: comments.filter((comment) =>
      selectedFilters.includes(comment.state),
    ),
    emptyText:
      selectedFilters.length === 0
        ? "Select a comment state to show comments."
        : selectedFilters.length === 1
          ? filters[selectedFilters[0]].emptyText
          : "No comments matching the selected states.",
  };
};
