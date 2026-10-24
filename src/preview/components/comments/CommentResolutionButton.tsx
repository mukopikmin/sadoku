import { Check, RotateCcw } from "lucide-react";
import type { Comment } from "../../models/comment";
import { toaster } from "../ui/toaster";
import { CommentActionButton } from "./CommentForm";
import type { RunCommentAction } from "./useCommentActionState";

type CommentResolutionButtonProps = {
  comment: Comment;
  disabled: boolean;
  onReopen: (id: number) => Promise<void>;
  onResolve: (id: number) => Promise<void>;
  runAction: RunCommentAction;
};

export const CommentResolutionButton = ({
  comment,
  disabled,
  onReopen,
  onResolve,
  runAction,
}: CommentResolutionButtonProps) => {
  const handleReopen = () =>
    runAction(() => onReopen(comment.id), {
      errorTitle: "Could not reopen comment",
    });

  const handleResolve = () =>
    runAction(() => onResolve(comment.id), {
      errorTitle: "Could not resolve comment",
      onSuccess: () => {
        toaster.create({
          action: {
            label: "Undo",
            onClick: () => {
              void handleReopen();
            },
          },
          closable: true,
          description: "The comment was resolved.",
          title: "Comment resolved",
          type: "success",
        });
      },
    });

  return (
    <CommentActionButton
      disabled={disabled}
      onClick={() => {
        void (comment.state === "resolved" ? handleReopen() : handleResolve());
      }}
      type="button"
    >
      {comment.state === "resolved"
        ? <RotateCcw aria-hidden="true" />
        : <Check aria-hidden="true" />}
      {comment.state === "resolved" ? "Reopen" : "Resolve"}
    </CommentActionButton>
  );
};
