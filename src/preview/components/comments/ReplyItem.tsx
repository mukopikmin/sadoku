import { Badge, Box, Flex, IconButton, Menu, Portal } from "@chakra-ui/react";
import { useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog";
import type { CommentReply } from "../../models/comment";
import { CommentActionButton, CommentForm } from "./CommentForm";
import { CommentMarkdown } from "./CommentMarkdown";
import { MoreActionsIcon } from "./MoreActionsIcon";
import { toaster } from "../ui/toaster";
import { CopyIcon } from "./CopyIcon";

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reply.body);
      toaster.create({
        closable: true,
        description: "The reply body was copied to the clipboard.",
        title: "Reply copied",
        type: "success",
      });
    } catch (error) {
      onError(error);
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
      pl="3"
      pr="1"
      position="relative"
      py="1"
    >
      {reply.author.type === "bot" && (
        <Flex
          align="center"
          gap="2"
          color="fg.muted"
          fontSize="xs"
          fontWeight="semibold"
          mb="0.5"
          pr="14"
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
        <Flex position="absolute" right="0" top="0">
          <IconButton
            aria-label="Copy reply"
            disabled={disabled}
            onClick={handleCopy}
            size="xs"
            variant="ghost"
          >
            <CopyIcon />
          </IconButton>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                aria-label="More actions for reply"
                disabled={disabled}
                size="xs"
                variant="ghost"
              >
                <MoreActionsIcon />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="edit" onClick={() => setIsEditing(true)}>
                    Edit
                  </Menu.Item>
                  <Menu.Item
                    value="delete"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
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
          <Box pr="14">
            <CommentMarkdown>{reply.body}</CommentMarkdown>
          </Box>
        )}
    </Box>
  );
};
