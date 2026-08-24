import { Badge, Box, Flex } from "@chakra-ui/react";
import { useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog";
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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

  const handleConfirmDelete = async () => {
    setSaving(true);
    try {
      await onDelete(commentId, reply.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      aria-label="Reply"
      as="article"
      bg="canvas.subtle"
      borderColor="border.muted"
      borderLeftWidth="3px"
      borderRadius="sm"
      className="comment-reply"
      ml="4"
      mt="2"
      pl="3"
      pr="2"
      position="relative"
      py="2"
    >
      {reply.author.type === "bot" && (
        <Flex
          align="center"
          gap="2"
          color="fg.muted"
          fontSize="xs"
          fontWeight="semibold"
          mb="1"
          pr="36"
        >
          <Badge colorPalette="purple" variant="subtle">Bot</Badge>
          {reply.reviewRequested && (
            <Badge colorPalette="blue" variant="subtle">
              Review requested
            </Badge>
          )}
        </Flex>
      )}
      {!isEditing && (
        <Flex gap="2" position="absolute" right="2" top="2" wrap="wrap">
          <CommentActionButton
            aria-label="Edit reply"
            disabled={disabled}
            onClick={() =>
              setIsEditing(true)}
            type="button"
          >
            Edit
          </CommentActionButton>
          <CommentActionButton
            aria-label="Delete reply"
            disabled={disabled}
            onClick={() =>
              setIsDeleteDialogOpen(true)}
            type="button"
          >
            Delete
          </CommentActionButton>
        </Flex>
      )}
      <ConfirmDialog
        confirmColorPalette="red"
        confirmLabel="Delete"
        isPending={disabled}
        onConfirm={handleConfirmDelete}
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
        title="Delete reply?"
      >
        This action cannot be undone.
      </ConfirmDialog>
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
        : (
          <Box pr="36">
            <CommentMarkdown>{reply.body}</CommentMarkdown>
          </Box>
        )}
    </Box>
  );
};
