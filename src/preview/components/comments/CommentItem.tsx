import {
  Badge,
  Box,
  Flex,
  IconButton,
  Menu,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import { ConfirmDialog } from "../ConfirmDialog";
import { CommentActionButton, CommentForm } from "./CommentForm";
import { CommentMarkdown } from "./CommentMarkdown";
import { CommentSourceMarkdown } from "./CommentSourceMarkdown";
import type { Comment } from "../../models/comment";
import { ReplyItem } from "./ReplyItem";
import { MoreActionsIcon } from "./MoreActionsIcon";
import { toaster } from "../ui/toaster";

export type CommentItemProps = {
  actions: CommentActions;
  comment: Comment;
  lineLabel: string;
  showSource?: boolean;
  showState?: boolean;
  variant?: "panel";
};

const getSourceLabel = (comment: Comment): string =>
  comment.state === "stale" ? "Original line" : "Target line";

export const CommentItem = ({
  actions,
  comment,
  lineLabel,
  showSource = false,
  showState = false,
  variant,
}: CommentItemProps) => {
  const {
    onDeleteComment,
    onDeleteReply,
    onReopenComment,
    onReplyComment,
    onResolveComment,
    onUpdateComment,
    onUpdateReply,
  } = actions;
  const [draft, setDraft] = useState(comment.body);
  const [replyDraft, setReplyDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const handleError = (
    error: unknown,
    title = "Comment action failed",
  ) => {
    const description = error instanceof Error ? error.message : String(error);
    setError(description);
    toaster.create({
      closable: true,
      description,
      title,
      type: "error",
    });
  };

  const runCommentAction = async (
    action: () => Promise<void>,
    onSuccess?: () => void,
    errorTitle?: string,
  ) => {
    setIsSaving(true);
    setError(undefined);
    try {
      await action();
      onSuccess?.();
    } catch (error) {
      handleError(error, errorTitle);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    const body = draft.trim();
    if (!body || isSaving) return;
    await runCommentAction(
      () => onUpdateComment(comment.id, body),
      () => setIsEditing(false),
      "Could not update comment",
    );
  };

  const handleConfirmDelete = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      await onDeleteComment(comment.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      handleError(error, "Could not delete comment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReply = async () => {
    const body = replyDraft.trim();
    if (!body || isSaving) return;
    await runCommentAction(
      () => onReplyComment(comment.id, body),
      () => {
        setReplyDraft("");
        setIsReplying(false);
      },
      "Could not add reply",
    );
  };

  const handleResolve = async () => {
    await runCommentAction(
      () => onResolveComment(comment.id),
      () => {
        toaster.create({
          action: {
            label: "Undo",
            onClick: () => {
              void onReopenComment(comment.id).catch((error) => {
                handleError(error, "Could not reopen comment");
              });
            },
          },
          closable: true,
          description: "The comment was resolved.",
          title: "Comment resolved",
          type: "success",
        });
      },
      "Could not resolve comment",
    );
  };

  const handleReopen = async () => {
    await runCommentAction(
      () => onReopenComment(comment.id),
      undefined,
      "Could not reopen comment",
    );
  };

  return (
    <Box
      as="article"
      p={variant === "panel" ? "2" : undefined}
    >
      {showSource && comment.sourceText && (
        <Box
          as="section"
          className="comment-source-target"
          mb="2"
        >
          <Text
            color="fg.muted"
            fontSize="xs"
            fontWeight="semibold"
            mb="1"
          >
            {getSourceLabel(comment)}
          </Text>
          <CommentSourceMarkdown>{comment.sourceText}</CommentSourceMarkdown>
        </Box>
      )}
      <Box
        borderLeftColor={variant === "panel" ? "accent" : undefined}
        borderLeftWidth={variant === "panel" ? "3px" : undefined}
        className="comment-root-thread"
        pl={variant === "panel" ? "3" : undefined}
        position="relative"
      >
        {(comment.author.type === "bot" ||
          (showState && comment.state !== "active")) && (
          <Flex align="center" gap="1.5" mb="0.5" pr="8">
            {comment.author.type === "bot" && (
              <Badge colorPalette="purple" variant="subtle">Bot</Badge>
            )}
            {showState && comment.state === "resolved" && (
              <Badge colorPalette="yellow" variant="outline">Resolved</Badge>
            )}
            {showState && comment.state === "stale" && (
              <Badge colorPalette="yellow" variant="outline">Stale</Badge>
            )}
          </Flex>
        )}
        {!isEditing && (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                aria-label="More actions"
                disabled={isSaving}
                minW="6"
                position="absolute"
                right="0"
                size="xs"
                top="0"
                variant="outline"
              >
                <MoreActionsIcon />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Box color="fg.muted" fontSize="xs" px="2" py="1">
                    {lineLabel}
                  </Box>
                  <Menu.Separator />
                  <Menu.Item
                    value={comment.state === "resolved" ? "reopen" : "resolve"}
                    onClick={comment.state === "resolved"
                      ? handleReopen
                      : handleResolve}
                  >
                    {comment.state === "resolved" ? "Reopen" : "Resolve"}
                  </Menu.Item>
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
        )}
        <ConfirmDialog
          confirmColorPalette="red"
          confirmLabel="Delete"
          isPending={isSaving}
          onConfirm={handleConfirmDelete}
          onOpenChange={setIsDeleteDialogOpen}
          open={isDeleteDialogOpen}
          title="Delete comment?"
        >
          This action cannot be undone.
        </ConfirmDialog>
        {isEditing
          ? (
            <CommentForm
              disabled={isSaving}
              onCancel={() => {
                setDraft(comment.body);
                setIsEditing(false);
              }}
              onChange={setDraft}
              onSubmit={() => void handleUpdate()}
              submitLabel="Save"
              value={draft}
            />
          )
          : (
            <Box pr="8">
              <CommentMarkdown>{comment.body}</CommentMarkdown>
            </Box>
          )}
        {(comment.replies ?? []).length > 0 && (
          <Stack gap="1" mt="1.5">
            {(comment.replies ?? []).map((reply) => (
              <ReplyItem
                commentId={comment.id}
                disabled={isSaving}
                key={reply.id}
                onDelete={onDeleteReply}
                onError={handleError}
                onUpdate={onUpdateReply}
                reply={reply}
                setSaving={setIsSaving}
              />
            ))}
          </Stack>
        )}
        {!isEditing && !isReplying && (
          <Flex justify="flex-end" mt="1">
            <CommentActionButton
              disabled={isSaving}
              onClick={() => setIsReplying(true)}
              type="button"
            >
              Reply
            </CommentActionButton>
          </Flex>
        )}
        {isReplying && (
          <Box mt="2">
            <CommentForm
              disabled={isSaving}
              onCancel={() => {
                setReplyDraft("");
                setIsReplying(false);
              }}
              onChange={setReplyDraft}
              onSubmit={() => void handleReply()}
              placeholder="Write a reply..."
              submitLabel="Add reply"
              textareaAriaLabel="Reply body"
              value={replyDraft}
            />
          </Box>
        )}
        {error && <Text color="red.500" fontSize="sm">{error}</Text>}
      </Box>
    </Box>
  );
};
