import { Badge, Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import type { Comment } from "../../models/comment";
import { CommentActionMenu } from "./CommentActionMenu";
import { CommentEditor } from "./CommentEditor";
import { CommentMarkdown } from "./CommentMarkdown";
import { CommentSourceMarkdown } from "./CommentSourceMarkdown";
import { ReplyComposer } from "./ReplyComposer";
import { ReplyItem } from "./ReplyItem";
import { useCommentActionState } from "./useCommentActionState";

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
  const [isEditing, setIsEditing] = useState(false);
  const { error, isPending, reportError, runAction } = useCommentActionState();

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
          <Flex align="center" gap="1.5" mb="0.5" pr="14">
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
            disabled={isPending}
            lineLabel={lineLabel}
            onDelete={onDeleteComment}
            onEdit={() => setIsEditing(true)}
            onReopen={onReopenComment}
            onResolve={onResolveComment}
            reportError={reportError}
            runAction={runAction}
          />
        )}
        {isEditing
          ? (
            <CommentEditor
              body={comment.body}
              commentId={comment.id}
              disabled={isPending}
              onClose={() => setIsEditing(false)}
              onUpdate={onUpdateComment}
              runAction={runAction}
            />
          )
          : (
            <Box pr="14">
              <CommentMarkdown>{comment.body}</CommentMarkdown>
            </Box>
          )}
        {(comment.replies ?? []).length > 0 && (
          <Stack gap="1" mt="1.5">
            {(comment.replies ?? []).map((reply) => (
              <ReplyItem
                commentId={comment.id}
                disabled={isPending}
                key={reply.id}
                onDelete={onDeleteReply}
                onUpdate={onUpdateReply}
                reportError={reportError}
                reply={reply}
                runAction={runAction}
              />
            ))}
          </Stack>
        )}
        <ReplyComposer
          commentId={comment.id}
          disabled={isPending}
          onReply={onReplyComment}
          runAction={runAction}
          showTrigger={!isEditing}
        />
        {error && <Text color="red.500" fontSize="sm">{error}</Text>}
      </Box>
    </Box>
  );
};
