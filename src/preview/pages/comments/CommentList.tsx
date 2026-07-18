import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { CommentThreadActions } from "../../api/commentActions";
import { CommentItem } from "../../components/comments/CommentItem";
import type { PreviewComment } from "../../api/comments";

export type CommentListProps = CommentThreadActions & {
  onReopenComment: (id: number) => Promise<void>;
  comments: PreviewComment[];
};

const formatRange = (line: number, endLine = line): string =>
  line === endLine ? `Line ${line}` : `Lines ${line}-${endLine}`;

const formatOriginalRange = (comment: PreviewComment): string =>
  formatRange(
    comment.originalStartLine,
    comment.originalEndLine,
  );

const formatLineLabel = (comment: PreviewComment): string => {
  const current = formatRange(comment.startLine, comment.endLine);
  const original = formatOriginalRange(comment);
  if (comment.stale) return `Originally ${original.toLowerCase()}`;
  if (
    comment.originalStartLine !== comment.startLine ||
    comment.originalEndLine !== comment.endLine
  ) {
    return `${current} (originally ${original.toLowerCase()})`;
  }
  return current;
};

type CommentSectionProps =
  & {
    comments: PreviewComment[];
    emptyText: string;
    title: string;
  }
  & Pick<
    CommentListProps,
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onReopenComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
  >;

const CommentSection = ({
  comments,
  emptyText,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onReopenComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
  title,
}: CommentSectionProps) => (
  <Box as="section">
    <Heading as="h2" size="xl" mt="0" mb="4">{title}</Heading>
    {comments.length === 0
      ? <Text color="fg.muted">{emptyText}</Text>
      : (
        <Stack gap="3">
          {comments.map((comment) => (
            <CommentItem
              variant="panel"
              comment={comment}
              key={comment.id}
              lineLabel={formatLineLabel(comment)}
              onDeleteComment={onDeleteComment}
              onDeleteReply={onDeleteReply}
              onReplyComment={onReplyComment}
              onReopenComment={onReopenComment}
              onResolveComment={onResolveComment}
              onUpdateComment={onUpdateComment}
              onUpdateReply={onUpdateReply}
              showSource
              showState
            />
          ))}
        </Stack>
      )}
  </Box>
);

export const CommentList = ({
  comments,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onReopenComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
}: CommentListProps) => {
  const activeComments = comments.filter((comment) =>
    !comment.resolved && !comment.stale
  );
  const staleComments = comments.filter((comment) =>
    !comment.resolved && comment.stale
  );
  const resolvedComments = comments.filter((comment) => comment.resolved);

  return (
    <Stack gap="7">
      <CommentSection
        comments={activeComments}
        emptyText="No active comments."
        onDeleteComment={onDeleteComment}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={onUpdateReply}
        title={`Active comments (${activeComments.length})`}
      />
      <CommentSection
        comments={staleComments}
        emptyText="No stale comments."
        onDeleteComment={onDeleteComment}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={onUpdateReply}
        title={`Stale comments (${staleComments.length})`}
      />
      <CommentSection
        comments={resolvedComments}
        emptyText="No resolved comments."
        onDeleteComment={onDeleteComment}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={onUpdateReply}
        title={`Resolved comments (${resolvedComments.length})`}
      />
    </Stack>
  );
};
