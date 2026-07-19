import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { CommentActions } from "../../api/commentActions";
import { CommentItem } from "../../components/comments/CommentItem";
import type {
  ActiveComment,
  Comment,
  ResolvedComment,
  StaleComment,
} from "../../models/comment";
import {
  useCommentActions,
  useCommentsQuery,
} from "../../hooks/usePreviewData";

export type CommentListProps = {
  actions: CommentActions;
  comments: Comment[];
};

const formatRange = (line: number, endLine = line): string =>
  line === endLine ? `Line ${line}` : `Lines ${line}-${endLine}`;

const formatOriginalRange = (comment: Comment): string =>
  formatRange(
    comment.originalStartLine,
    comment.originalEndLine,
  );

const formatLineLabel = (comment: Comment): string => {
  const current = formatRange(comment.startLine, comment.endLine);
  const original = formatOriginalRange(comment);
  if (comment.state === "stale") return `Originally ${original.toLowerCase()}`;
  if (
    comment.originalStartLine !== comment.startLine ||
    comment.originalEndLine !== comment.endLine
  ) {
    return `${current} (originally ${original.toLowerCase()})`;
  }
  return current;
};

type CommentSectionProps<T extends Comment> = {
  actions: CommentActions;
  comments: T[];
  emptyText: string;
  title: string;
};

const CommentSection = <T extends Comment>({
  actions,
  comments,
  emptyText,
  title,
}: CommentSectionProps<T>) => (
  <Box as="section">
    <Heading as="h2" size="xl" mt="0" mb="4">{title}</Heading>
    {comments.length === 0
      ? <Text color="fg.muted">{emptyText}</Text>
      : (
        <Stack gap="3">
          {comments.map((comment) => (
            <CommentItem
              actions={actions}
              variant="panel"
              comment={comment}
              key={comment.id}
              lineLabel={formatLineLabel(comment)}
              showSource
              showState
            />
          ))}
        </Stack>
      )}
  </Box>
);

export const CommentList = ({
  actions,
  comments,
}: CommentListProps) => {
  const activeComments = comments.filter(
    (comment): comment is ActiveComment => comment.state === "active",
  );
  const staleComments = comments.filter(
    (comment): comment is StaleComment => comment.state === "stale",
  );
  const resolvedComments = comments.filter(
    (comment): comment is ResolvedComment => comment.state === "resolved",
  );

  return (
    <Stack gap="7">
      <CommentSection
        actions={actions}
        comments={activeComments}
        emptyText="No active comments."
        title={`Active comments (${activeComments.length})`}
      />
      <CommentSection
        actions={actions}
        comments={staleComments}
        emptyText="No stale comments."
        title={`Stale comments (${staleComments.length})`}
      />
      <CommentSection
        actions={actions}
        comments={resolvedComments}
        emptyText="No resolved comments."
        title={`Resolved comments (${resolvedComments.length})`}
      />
    </Stack>
  );
};

export const CommentListPage = () => {
  const commentsQuery = useCommentsQuery();
  const actions = useCommentActions();
  if (!commentsQuery.data) return null;
  return (
    <CommentList actions={actions} comments={commentsQuery.data.comments} />
  );
};
