import { Box, Flex, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { CommentReply } from "../../models/comment";
import { CommentActionButton, CommentForm } from "./CommentForm";
import { CommentMarkdown } from "./CommentMarkdown";

type ReplyItemProps = {
  commentId: number;
  disabled: boolean;
  onDelete: (commentId: number, replyId: number) => Promise<void>;
  onError: (error: unknown) => void;
  onUpdate: (
    commentId: number,
    replyId: number,
    body: string,
  ) => Promise<void>;
  reply: CommentReply;
  setSaving: (saving: boolean) => void;
};

export const ReplyItem = ({
  commentId,
  disabled,
  onDelete,
  onError,
  onUpdate,
  reply,
  setSaving,
}: ReplyItemProps) => {
  const [draft, setDraft] = useState(reply.body);
  const [isEditing, setIsEditing] = useState(false);

  const handleUpdate = async () => {
    const body = draft.trim();
    if (!body || disabled) return;
    setSaving(true);
    try {
      await onUpdate(commentId, reply.id, body);
      setIsEditing(false);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete(commentId, reply.id);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      bg="canvas.subtle"
      borderColor="border.muted"
      borderLeftWidth="3px"
      borderRadius="sm"
      className="comment-reply"
      ml="4"
      mt="2"
      pl="3"
      pr="2"
      py="2"
    >
      <Flex align="center" justify="space-between" gap="2" mb="1">
        <Text color="fg.muted" fontSize="xs" fontWeight="semibold">Reply</Text>
        {!isEditing && (
          <Flex wrap="wrap" gap="2">
            <CommentActionButton
              aria-label="Edit reply"
              disabled={disabled}
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit
            </CommentActionButton>
            <CommentActionButton
              aria-label="Delete reply"
              disabled={disabled}
              onClick={handleDelete}
              type="button"
            >
              Delete
            </CommentActionButton>
          </Flex>
        )}
      </Flex>
      {isEditing
        ? (
          <CommentForm
            cancelAriaLabel="Cancel reply edit"
            disabled={disabled}
            onCancel={() => {
              setDraft(reply.body);
              setIsEditing(false);
            }}
            onChange={setDraft}
            onSubmit={() => void handleUpdate()}
            submitAriaLabel="Save reply"
            submitLabel="Save"
            textareaAriaLabel="Edit reply body"
            value={draft}
          />
        )
        : <CommentMarkdown>{reply.body}</CommentMarkdown>}
    </Box>
  );
};
