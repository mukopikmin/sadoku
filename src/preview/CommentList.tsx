import { Heading, Text } from "@radix-ui/themes";
import { CommentItem } from "./CommentItem";
import type { PreviewComment } from "./comments";

export type CommentListProps = {
  comments: PreviewComment[];
  onDeleteComment: (id: number) => Promise<void>;
  onDeleteReply: (commentId: number, replyId: number) => Promise<void>;
  onReplyComment: (id: number, body: string) => Promise<void>;
  onReopenComment: (id: number) => Promise<void>;
  onResolveComment: (id: number) => Promise<void>;
  onUpdateComment: (id: number, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: number,
    replyId: number,
    body: string,
  ) => Promise<void>;
};

const formatLineLabel = (comment: PreviewComment): string => {
  if (comment.stale) return `Originally line ${comment.originalLine}`;
  if (comment.originalLine !== comment.line) {
    return `Line ${comment.line} (originally ${comment.originalLine})`;
  }
  return `Line ${comment.line}`;
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
  <section className="comment-list-section">
    <Heading as="h2" mb="3" size="5">
      {title}
    </Heading>
    {comments.length === 0
      ? <Text className="comment-list-empty" color="gray">{emptyText}</Text>
      : (
        <div className="comment-list-items">
          {comments.map((comment) => (
            <CommentItem
              className="comment-list-item"
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
        </div>
      )}
  </section>
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
    <div className="comment-list">
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
    </div>
  );
};
