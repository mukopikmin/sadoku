import { Badge, Box, Card, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import type { Comment } from "../../models/comment";
import { CommentActionMenu } from "./CommentActionMenu";
import { CommentEditor } from "./CommentEditor";
import { CommentMarkdown } from "./CommentMarkdown";
import { CommentResolutionButton } from "./CommentResolutionButton";
import { CommentSourcePreview } from "./CommentSourcePreview";
import { ReplyComposer } from "./ReplyComposer";
import { ReplyItem } from "./ReplyItem";
import { useCommentActionState } from "./useCommentActionState";

export type CommentItemProps = {
  actions: CommentActions;
  comment: Comment;
  disabled?: boolean;
  lineLabel: string;
  showSource?: boolean;
  showState?: boolean;
  variant?: "card";
};

export const CommentItem = ({
  actions,
  comment,
  disabled = false,
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
  const [isEditing, setIsEditing] = useState(false);
  const { error, isPending, reportError, runAction } = useCommentActionState();
  const isDisabled = disabled || isPending;

  const content = (
    <>
      {showSource && <CommentSourcePreview comment={comment} />}
      <Box
        borderLeftColor="accent"
        borderLeftWidth="3px"
        className="comment-root-thread"
        pb="1px"
        pl="3"
        pt="2"
      >
        <Box position="relative">
          {(comment.author.type === "bot" ||
            (showState && comment.state !== "active")) && (
            <Flex align="center" gap="1.5" my="2" pr="8">
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
            <CommentActionMenu
              comment={comment}
              disabled={isDisabled}
              lineLabel={lineLabel}
              onDelete={onDeleteComment}
              onExport={actions.onExportComment}
              onEdit={() => setIsEditing(true)}
              reportError={reportError}
              runAction={runAction}
            />
          )}
          {isEditing
            ? (
              <CommentEditor
                body={comment.body}
                commentId={comment.id}
                disabled={isDisabled}
                onClose={() => setIsEditing(false)}
                onUpdate={onUpdateComment}
                runAction={runAction}
              />
            )
            : (
              <Box pr="8">
                <CommentMarkdown sourceText={comment.sourceText}>
                  {comment.body}
                </CommentMarkdown>
              </Box>
            )}
          {(comment.replies ?? []).length > 0 && (
            <Stack gap="3" mt="3">
              {(comment.replies ?? []).map((reply) => (
                <ReplyItem
                  commentId={comment.id}
                  disabled={isDisabled}
                  key={reply.id}
                  onDelete={onDeleteReply}
                  onUpdate={onUpdateReply}
                  reportError={reportError}
                  reply={reply}
                  sourceText={comment.sourceText}
                  runAction={runAction}
                />
              ))}
            </Stack>
          )}
          <ReplyComposer
            commentId={comment.id}
            disabled={isDisabled}
            onReply={onReplyComment}
            runAction={runAction}
            showTrigger={!isEditing}
            trailingAction={
              <CommentResolutionButton
                comment={comment}
                disabled={isDisabled}
                onReopen={onReopenComment}
                onResolve={onResolveComment}
                runAction={runAction}
              />
            }
          />
          {error && <Text color="red.500" fontSize="sm">{error}</Text>}
        </Box>
      </Box>
    </>
  );

  if (variant === "card") {
    return (
      <Card.Root as="article" size="sm">
        <Card.Body>{content}</Card.Body>
      </Card.Root>
    );
  }

  return <Box as="article">{content}</Box>;
};
