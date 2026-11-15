import { useState } from "react";
import { useClipboard } from "../../hooks/useClipboard";
import type { GitHubCommentExport } from "../../models/comment";
import type { CommentActionMenuProps } from "./CommentActionMenu";

export const useCommentMenu = ({
  comment,
  disabled,
  onDelete,
  onExport,
  reportError,
  runAction,
}: CommentActionMenuProps) => {
  const [state, setState] = useState<
    { status: "idle" } | { status: "confirming-delete" }
  >({ status: "idle" });
  const [exportState, setExportState] = useState<
    { status: "idle" } | { status: "exported"; result: GitHubCommentExport }
  >({ status: "idle" });
  const clipboard = useClipboard(comment.body, {
    title: "Comment copied",
    description: "The comment body was copied to the clipboard.",
    onError: (error) => reportError(error, "Could not copy comment"),
  });
  return {
    state,
    exportState,
    copy: clipboard.copy,
    setDeleteOpen: (open: boolean) => {
      if (!disabled) setState({ status: open ? "confirming-delete" : "idle" });
    },
    remove: () => {
      if (disabled || state.status !== "confirming-delete") return;
      return runAction(() => onDelete(comment.id), {
        errorTitle: "Could not delete comment",
        onSuccess: () => setState({ status: "idle" }),
      });
    },
    exportToGitHub: () => {
      if (
        disabled ||
        !onExport ||
        comment.author.type !== "human" ||
        comment.state !== "active"
      )
        return;
      return runAction(
        async () =>
          setExportState({
            status: "exported",
            result: await onExport(comment.id),
          }),
        { errorTitle: "Could not save to GitHub review" },
      );
    },
  };
};
