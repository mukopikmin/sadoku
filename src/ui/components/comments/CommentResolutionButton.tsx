import { Check, RotateCcw } from "lucide-react";
import type { Comment } from "../../models/comment";
import { useCommentResolution } from "./useCommentResolution";
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
  const resolution = useCommentResolution({
    comment,
    disabled,
    onReopen,
    onResolve,
    runAction,
  });

  return (
    <CommentActionButton
      colorPalette={resolution.action === "reopen" ? "gray" : "green"}
      disabled={disabled}
      onClick={() => void resolution.run()}
      type="button"
      variant="outline"
    >
      {resolution.action === "reopen" ? (
        <RotateCcw aria-hidden="true" />
      ) : (
        <Check aria-hidden="true" />
      )}
      {resolution.action === "reopen" ? "Reopen" : "Resolve"}
    </CommentActionButton>
  );
};
