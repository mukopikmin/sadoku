import { Badge, Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import { ConfirmDialog } from "../ConfirmDialog";
import { CommentActionButton, CommentForm } from "./CommentForm";
import { CommentMarkdown } from "./CommentMarkdown";
import type { Comment } from "../../models/comment";
import { ReplyItem } from "./ReplyItem";

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

  const handleError = (error: unknown) => {
    setError(error instanceof Error ? error.message : String(error));
  };

  const runCommentAction = async (
    action: () => Promise<void>,
    onSuccess?: () => void,
  ) => {
    setIsSaving(true);
    setError(undefined);
    try {
      await action();
      onSuccess?.();
    } catch (error) {
      handleError(error);
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
    );
  };

  const handleConfirmDelete = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      await onDeleteComment(comment.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      handleError(error);
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
    );
  };

  const handleResolve = async () => {
    await runCommentAction(() => onResolveComment(comment.id));
  };

  const handleReopen = async () => {
    await runCommentAction(() => onReopenComment(comment.id));
  };

  return (
    <Box
      as="article"
      borderColor="border.muted"
      borderRadius={variant === "panel" ? "md" : undefined}
      borderWidth={variant === "panel" ? "1px" : undefined}
      mb="1.5"
      p={variant === "panel" ? "3" : undefined}
    >
      <Flex align="center" justify="space-between" gap="2" mb="1">
        <Flex
          align="center"
          gap="2"
          color="fg.muted"
          fontSize="xs"
          fontWeight="semibold"
        >
          <Text as="span">{lineLabel}</Text>
          {showState && comment.state === "resolved" && (
            <Badge colorPalette="yellow" variant="outline">Resolved</Badge>
          )}
          {showState && comment.state === "stale" && (
            <Badge colorPalette="yellow" variant="outline">Stale</Badge>
          )}
        </Flex>
        {!isEditing && (
          <Flex wrap="wrap" gap="2">
            {comment.state === "resolved"
              ? (
                <CommentActionButton
                  disabled={isSaving}
                  onClick={handleReopen}
                  type="button"
                >
                  Reopen
                </CommentActionButton>
              )
              : (
                <CommentActionButton
                  disabled={isSaving}
                  onClick={handleResolve}
                  type="button"
                >
                  Resolve
                </CommentActionButton>
              )}
            <CommentActionButton
              disabled={isSaving}
              onClick={() => setIsReplying((value) => !value)}
              type="button"
            >
              Reply
            </CommentActionButton>
            <CommentActionButton
              disabled={isSaving}
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit
            </CommentActionButton>
            <CommentActionButton
              disabled={isSaving}
              onClick={() => setIsDeleteDialogOpen(true)}
              type="button"
            >
              Delete
            </CommentActionButton>
          </Flex>
        )}
      </Flex>
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
      {showSource && comment.sourceText && (
        <Box mb="2">
          <Text mb="1" color="fg.muted" fontSize="xs" fontWeight="semibold">
            {getSourceLabel(comment)}
          </Text>
          <Box as="pre" maxH="160px" mb="2" fontSize="xs" whiteSpace="pre-wrap">
            {comment.sourceText}
          </Box>
        </Box>
      )}
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
        : <CommentMarkdown>{comment.body}</CommentMarkdown>}
      {(comment.replies ?? []).length > 0 && (
        <Stack gap="2" mt="2">
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
  );
};
