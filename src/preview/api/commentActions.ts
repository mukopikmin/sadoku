export type CommentThreadActions = {
  onDeleteComment: (id: number) => Promise<void>;
  onDeleteReply: (commentId: number, replyId: number) => Promise<void>;
  onReplyComment: (id: number, body: string) => Promise<void>;
  onResolveComment: (id: number) => Promise<void>;
  onUpdateComment: (id: number, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: number,
    replyId: number,
    body: string,
  ) => Promise<void>;
};

export type CommentActions = CommentThreadActions & {
  onCreateComment: (
    startLine: number,
    body: string,
    endLine: number,
  ) => Promise<void>;
  onReopenComment: (id: number) => Promise<void>;
};
