import { Box, Flex } from "@chakra-ui/react";
import { useState } from "react";
import { CommentActionButton, CommentForm } from "./CommentForm";
import type { RunCommentAction } from "./useCommentActionState";

type ReplyComposerProps = {
  commentId: number;
  disabled: boolean;
  onReply: (id: number, body: string) => Promise<void>;
  runAction: RunCommentAction;
  showTrigger: boolean;
};

export const ReplyComposer = ({
  commentId,
  disabled,
  onReply,
  runAction,
  showTrigger,
}: ReplyComposerProps) => {
  const [draft, setDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const close = () => {
    setDraft("");
    setIsReplying(false);
  };

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || disabled) return;
    await runAction(() => onReply(commentId, body), {
      errorTitle: "Could not add reply",
      onSuccess: close,
    });
  };

  if (!isReplying) {
    return showTrigger
      ? (
        <Flex justify="flex-end" mt="1">
          <CommentActionButton
            disabled={disabled}
            onClick={() => setIsReplying(true)}
            type="button"
          >
            Reply
          </CommentActionButton>
        </Flex>
      )
      : null;
  }

  return (
    <Box mt="2">
      <CommentForm
        disabled={disabled}
        onCancel={close}
        onChange={setDraft}
        onSubmit={() => void handleSubmit()}
        placeholder="Write a reply..."
        submitLabel="Add reply"
        textareaAriaLabel="Reply body"
        value={draft}
      />
    </Box>
  );
};
