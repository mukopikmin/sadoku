import { Flex } from "@chakra-ui/react";
import { Reply } from "lucide-react";
import { type ReactNode } from "react";
import { useCommentDraft } from "./useCommentDraft";
import { CommentActionButton, CommentForm } from "./CommentForm";
import type { RunCommentAction } from "./useCommentActionState";

type ReplyComposerProps = {
  commentId: number;
  disabled: boolean;
  onReply: (id: number, body: string) => Promise<void>;
  runAction: RunCommentAction;
  showTrigger: boolean;
  trailingAction?: ReactNode;
};

export const ReplyComposer = ({
  commentId,
  disabled,
  onReply,
  runAction,
  showTrigger,
  trailingAction,
}: ReplyComposerProps) => {
  const editor = useCommentDraft({
    initiallyOpen: false,
    commentId,
    disabled,
    runAction,
    onSubmit: (draft) => onReply(commentId, draft),
    errorTitle: "Could not add reply",
  });

  if (editor.state.status === "closed") {
    return showTrigger ? (
      <Flex align="center" justify="space-between" gap="2">
        <CommentActionButton
          disabled={disabled}
          onClick={() => editor.open()}
          type="button"
          variant="surface"
        >
          <Reply aria-hidden="true" />
          Reply
        </CommentActionButton>
        {trailingAction}
      </Flex>
    ) : null;
  }

  return (
    <CommentForm
      disabled={disabled || editor.state.status === "saving"}
      onCancel={editor.close}
      onChange={editor.change}
      onSubmit={() => void editor.save()}
      placeholder="Write a reply..."
      submitLabel="Add reply"
      textareaAriaLabel="Reply body"
      value={editor.state.draft}
    />
  );
};
