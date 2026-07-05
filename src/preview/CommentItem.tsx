import { Badge, Box, Button, Card, Text, TextArea } from "@radix-ui/themes";
import { useState } from "react";
import { submitCommentOnShortcut } from "./commentShortcuts";
import type { PreviewComment, PreviewCommentReply } from "./comments";

export type CommentItemProps = {
  className?: string;
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
};

const getSourceLabel = (comment: PreviewComment): string =>
  comment.stale ? "Original line" : "Target line";

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
    <Box className="comment-reply">
      <div className="comment-reply-header">
        <Text className="comment-reply-label" size="1" weight="bold">
          Reply
        </Text>
        {!isEditing && (
          <div className="comment-actions">
            <Button
              aria-label="Edit reply"
              disabled={disabled}
              onClick={() => setIsEditing(true)}
              size="1"
              type="button"
              variant="soft"
            >
              Edit
            </Button>
            <Button
              aria-label="Delete reply"
              color="red"
              disabled={disabled}
              onClick={handleDelete}
              size="1"
              type="button"
              variant="soft"
            >
              Delete
            </Button>
          </div>
        )}
      </div>
      {isEditing
        ? (
          <>
            <TextArea
              aria-label="Edit reply body"
              autoFocus
              className="comment-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) =>
                submitCommentOnShortcut(event, () => {
                  void handleUpdate();
                })}
              value={draft}
            />
            <div className="comment-actions">
              <Button
                aria-label="Save reply"
                disabled={disabled || draft.trim() === ""}
                onClick={handleUpdate}
                size="1"
                type="button"
              >
                Save
              </Button>
              <Button
                aria-label="Cancel reply edit"
                color="gray"
                disabled={disabled}
                onClick={() => {
                  setDraft(reply.body);
                  setIsEditing(false);
                }}
                size="1"
                type="button"
                variant="soft"
              >
                Cancel
              </Button>
            </div>
          </>
        )
        : <Card className="comment-body" size="1">{reply.body}</Card>}
    </Box>
  );
};

export const CommentItem = ({
  className,
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
    <Card
      asChild
      className={["comment-item", className].filter(Boolean).join(" ")}
      size="2"
    >
      <article>
        <div className="comment-item-header">
          <div className="comment-thread-heading">
            <span>{lineLabel}</span>
            {showState && comment.resolved && (
              <Badge className="comment-state" color="green" variant="soft">
                Resolved
              </Badge>
            )}
            {showState && !comment.resolved && comment.stale && (
              <Badge className="comment-state" color="amber" variant="soft">
                Stale
              </Badge>
            )}
          </div>
          {!isEditing && (
            <div className="comment-actions">
              {comment.resolved
                ? (
                  onReopenComment && (
                    <Button
                      disabled={isSaving}
                      onClick={handleReopen}
                      size="1"
                      type="button"
                      variant="soft"
                    >
                      Reopen
                    </Button>
                  )
                )
                : (
                  onResolveComment && (
                    <Button
                      disabled={isSaving}
                      onClick={handleResolve}
                      size="1"
                      type="button"
                      variant="soft"
                    >
                      Resolve
                    </Button>
                  )
                )}
              <Button
                disabled={isSaving}
                onClick={() => setIsReplying((value) => !value)}
                size="1"
                type="button"
                variant="soft"
              >
                Reply
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => setIsEditing(true)}
                size="1"
                type="button"
                variant="soft"
              >
                Edit
              </Button>
              <Button
                color="red"
                disabled={isSaving}
                onClick={handleDelete}
                size="1"
                type="button"
                variant="soft"
              >
                Delete
              </Button>
            </div>
          )}
        </div>
        {showSource && comment.sourceText && (
          <div className="comment-source-block">
            <div className="comment-source-label">
              {getSourceLabel(comment)}
            </div>
            <pre className="comment-source">{comment.sourceText}</pre>
          </div>
        )}
        {isEditing
          ? (
            <>
              <TextArea
                autoFocus
                className="comment-input"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) =>
                  submitCommentOnShortcut(event, () => {
                    void handleUpdate();
                  })}
                value={draft}
              />
              <div className="comment-actions">
                <Button
                  disabled={isSaving || draft.trim() === ""}
                  onClick={handleUpdate}
                  size="1"
                  type="button"
                >
                  Save
                </Button>
                <Button
                  color="gray"
                  disabled={isSaving}
                  onClick={() => {
                    setDraft(comment.body);
                    setIsEditing(false);
                  }}
                  size="1"
                  type="button"
                  variant="soft"
                >
                  Cancel
                </Button>
              </div>
            </>
          )
          : <Card className="comment-body" size="1">{comment.body}</Card>}
        {(comment.replies ?? []).length > 0 && (
          <div className="comment-replies">
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
          </div>
        )}
        {isReplying && (
          <div className="comment-reply-form">
            <TextArea
              aria-label="Reply body"
              autoFocus
              className="comment-input"
              onChange={(event) => setReplyDraft(event.target.value)}
              onKeyDown={(event) =>
                submitCommentOnShortcut(event, () => {
                  void handleReply();
                })}
              placeholder="Write a reply..."
              value={replyDraft}
            />
            <div className="comment-actions">
              <Button
                disabled={isSaving || replyDraft.trim() === ""}
                onClick={handleReply}
                size="1"
                type="button"
              >
                Add reply
              </Button>
              <Button
                color="gray"
                disabled={isSaving}
                onClick={() => {
                  setReplyDraft("");
                  setIsReplying(false);
                }}
                size="1"
                type="button"
                variant="soft"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && (
          <Text className="comment-error" color="red" size="2">{error}</Text>
        )}
      </article>
    </Card>
  );
};
