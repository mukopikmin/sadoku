import type { Comment } from "../../models/comment";
import { toaster } from "../ui/toaster";
import type { RunCommentAction } from "./useCommentActionState";

type Options = {
  comment: Comment;
  disabled: boolean;
  onReopen: (id: number) => Promise<void>;
  onResolve: (id: number) => Promise<void>;
  runAction: RunCommentAction;
};
export const useCommentResolution = ({
  comment,
  disabled,
  onReopen,
  onResolve,
  runAction,
}: Options) => {
  const reopen = () =>
    runAction(() => onReopen(comment.id), {
      errorTitle: "Could not reopen comment",
    });
  return {
    action:
      comment.state === "resolved" ? ("reopen" as const) : ("resolve" as const),
    run: () => {
      if (disabled) return;
      if (comment.state === "resolved") return reopen();
      return runAction(() => onResolve(comment.id), {
        errorTitle: "Could not resolve comment",
        onSuccess: () =>
          toaster.create({
            action: {
              label: "Undo",
              onClick: () => {
                void reopen();
              },
            },
            closable: true,
            description: "The comment was resolved.",
            title: "Comment resolved",
            type: "success",
          }),
      });
    },
  };
};
