import {
  Badge,
  Box,
  Button,
  Flex,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { type ComponentProps, useState } from "react";
import { submitCommentOnShortcut } from "./commentShortcuts";
import type { PreviewComment, PreviewCommentReply } from "./comments";

export type CommentItemProps = {
  comment: PreviewComment;
  lineLabel: string;
  onDeleteComment: (id: number) => Promise<void>;
  onDeleteReply: (commentId: number, replyId: number) => Promise<void>;
  onReplyComment: (id: number, body: string) => Promise<void>;
  onReopenComment?: (id: number) => Promise<void>;
  onResolveComment?: (id: number) => Promise<void>;
  onUpdateComment: (id: number, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: number,
    replyId: number,
    body: string,
  ) => Promise<void>;
  showSource?: boolean;
  showState?: boolean;
  variant?: "panel";
};

const getSourceLabel = (comment: PreviewComment): string =>
  comment.stale ? "Original line" : "Target line";

const ActionButton = (props: ComponentProps<typeof Button>) => (
  <Button size="xs" variant="outline" {...props} />
);

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
  reply: PreviewCommentReply;
  setSaving: (saving: boolean) => void;
};

const ReplyItem = ({
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
            <ActionButton
              aria-label="Edit reply"
              disabled={disabled}
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit
            </ActionButton>
            <ActionButton
              aria-label="Delete reply"
              disabled={disabled}
              onClick={handleDelete}
              type="button"
            >
              Delete
            </ActionButton>
          </Flex>
        )}
      </Flex>
      {isEditing
        ? (
          <Stack gap="2">
            <Textarea
              aria-label="Edit reply body"
              autoFocus
              minH="90px"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) =>
                submitCommentOnShortcut(event, () => {
                  void handleUpdate();
                })}
              value={draft}
            />
            <Flex wrap="wrap" gap="2">
              <ActionButton
                aria-label="Save reply"
                disabled={disabled || draft.trim() === ""}
                onClick={handleUpdate}
                type="button"
              >
                Save
              </ActionButton>
              <ActionButton
                aria-label="Cancel reply edit"
                disabled={disabled}
                onClick={() => {
                  setDraft(reply.body);
                  setIsEditing(false);
                }}
                type="button"
              >
                Cancel
              </ActionButton>
            </Flex>
          </Stack>
        )
        : <Text whiteSpace="pre-wrap">{reply.body}</Text>}
    </Box>
  );
};

export const CommentItem = ({
  comment,
  lineLabel,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onReopenComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
  showSource = false,
  showState = false,
  variant,
}: CommentItemProps) => {
  const [draft, setDraft] = useState(comment.body);
  const [replyDraft, setReplyDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const handleError = (error: unknown) => {
    setError(error instanceof Error ? error.message : String(error));
  };

  const handleUpdate = async () => {
    const body = draft.trim();
    if (!body || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onUpdateComment(comment.id, body);
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      await onDeleteComment(comment.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setIsSaving(false);
    }
  };

  const handleReply = async () => {
    const body = replyDraft.trim();
    if (!body || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onReplyComment(comment.id, body);
      setReplyDraft("");
      setIsReplying(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!onResolveComment) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onResolveComment(comment.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!onReopenComment) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onReopenComment(comment.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
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
          {showState && comment.resolved && (
            <Badge colorPalette="yellow" variant="outline">Resolved</Badge>
          )}
          {showState && !comment.resolved && comment.stale && (
            <Badge colorPalette="yellow" variant="outline">Stale</Badge>
          )}
        </Flex>
        {!isEditing && (
          <Flex wrap="wrap" gap="2">
            {comment.resolved
              ? onReopenComment && (
                <ActionButton
                  disabled={isSaving}
                  onClick={handleReopen}
                  type="button"
                >
                  Reopen
                </ActionButton>
              )
              : onResolveComment && (
                <ActionButton
                  disabled={isSaving}
                  onClick={handleResolve}
                  type="button"
                >
                  Resolve
                </ActionButton>
              )}
            <ActionButton
              disabled={isSaving}
              onClick={() => setIsReplying((value) => !value)}
              type="button"
            >
              Reply
            </ActionButton>
            <ActionButton
              disabled={isSaving}
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit
            </ActionButton>
            <ActionButton
              disabled={isSaving}
              onClick={handleDelete}
              type="button"
            >
              Delete
            </ActionButton>
          </Flex>
        )}
      </Flex>
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
          <Stack gap="2">
            <Textarea
              autoFocus
              minH="90px"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) =>
                submitCommentOnShortcut(event, () => {
                  void handleUpdate();
                })}
              value={draft}
            />
            <Flex wrap="wrap" gap="2">
              <ActionButton
                disabled={isSaving || draft.trim() === ""}
                onClick={handleUpdate}
                type="button"
              >
                Save
              </ActionButton>
              <ActionButton
                disabled={isSaving}
                onClick={() => {
                  setDraft(comment.body);
                  setIsEditing(false);
                }}
                type="button"
              >
                Cancel
              </ActionButton>
            </Flex>
          </Stack>
        )
        : <Text whiteSpace="pre-wrap">{comment.body}</Text>}
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
        <Stack gap="2" mt="2">
          <Textarea
            aria-label="Reply body"
            autoFocus
            minH="90px"
            onChange={(event) => setReplyDraft(event.target.value)}
            onKeyDown={(event) =>
              submitCommentOnShortcut(event, () => {
                void handleReply();
              })}
            placeholder="Write a reply..."
            value={replyDraft}
          />
          <Flex wrap="wrap" gap="2">
            <ActionButton
              disabled={isSaving || replyDraft.trim() === ""}
              onClick={handleReply}
              type="button"
            >
              Add reply
            </ActionButton>
            <ActionButton
              disabled={isSaving}
              onClick={() => {
                setReplyDraft("");
                setIsReplying(false);
              }}
              type="button"
            >
              Cancel
            </ActionButton>
          </Flex>
        </Stack>
      )}
      {error && <Text color="red.500" fontSize="sm">{error}</Text>}
    </Box>
  );
};
