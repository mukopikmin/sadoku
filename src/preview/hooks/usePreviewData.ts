import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommentActions } from "../api/commentActions";
import {
  createComment,
  createReply,
  deleteComment,
  deleteReply,
  loadComments,
  reopenComment,
  resolveComment,
  updateComment,
  updateReply,
} from "../api/comments";
import type { Comment, CommentsDocument } from "../models/comment";
import { loadPreviewDocument } from "../api/document";

export const previewDocumentQueryKey = ["preview-document"] as const;
export const commentsQueryKey = ["comments"] as const;

export const usePreviewDocumentQuery = () =>
  useQuery({
    queryFn: loadPreviewDocument,
    queryKey: previewDocumentQueryKey,
  });

export const useCommentsQuery = () =>
  useQuery({
    queryFn: loadComments,
    queryKey: commentsQueryKey,
  });

export const useCommentActions = (): CommentActions => {
  const queryClient = useQueryClient();

  const updateComments = (
    updater: (current: Comment[]) => Comment[],
  ) => {
    queryClient.setQueryData<CommentsDocument>(
      commentsQueryKey,
      (current) =>
        current && {
          ...current,
          comments: updater(current.comments),
        },
    );
  };
  const replaceComment = (updated: Comment) => {
    updateComments((comments) =>
      comments.map((comment) => comment.id === updated.id ? updated : comment)
    );
  };

  const createCommentMutation = useMutation({
    mutationFn: ({
      body,
      endLine,
      startLine,
    }: {
      body: string;
      endLine: number;
      startLine: number;
    }) => createComment(startLine, body, endLine),
    onSuccess: (created) => {
      updateComments((comments) => [...comments, created]);
    },
  });
  const updateCommentMutation = useMutation({
    mutationFn: ({ body, id }: { body: string; id: number }) =>
      updateComment(id, body),
    onSuccess: replaceComment,
  });
  const replyCommentMutation = useMutation({
    mutationFn: ({ body, id }: { body: string; id: number }) =>
      createReply(id, body),
    onSuccess: replaceComment,
  });
  const deleteCommentMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: (_data, id) => {
      updateComments((comments) =>
        comments.filter((comment) => comment.id !== id)
      );
    },
  });
  const updateReplyMutation = useMutation({
    mutationFn: ({
      body,
      commentId,
      replyId,
    }: {
      body: string;
      commentId: number;
      replyId: number;
    }) => updateReply(commentId, replyId, body),
    onSuccess: replaceComment,
  });
  const deleteReplyMutation = useMutation({
    mutationFn: ({
      commentId,
      replyId,
    }: {
      commentId: number;
      replyId: number;
    }) => deleteReply(commentId, replyId),
    onSuccess: (_data, { commentId, replyId }) => {
      updateComments((comments) =>
        comments.map((comment) =>
          comment.id === commentId
            ? {
              ...comment,
              replies: (comment.replies ?? []).filter((reply) =>
                reply.id !== replyId
              ),
            }
            : comment
        )
      );
    },
  });
  const resolveCommentMutation = useMutation({
    mutationFn: resolveComment,
    onSuccess: replaceComment,
  });
  const reopenCommentMutation = useMutation({
    mutationFn: reopenComment,
    onSuccess: replaceComment,
  });

  return {
    onCreateComment: async (startLine, body, endLine) => {
      await createCommentMutation.mutateAsync({ body, endLine, startLine });
    },
    onDeleteComment: async (id) => {
      await deleteCommentMutation.mutateAsync(id);
    },
    onDeleteReply: async (commentId, replyId) => {
      await deleteReplyMutation.mutateAsync({ commentId, replyId });
    },
    onReopenComment: async (id) => {
      await reopenCommentMutation.mutateAsync(id);
    },
    onReplyComment: async (id, body) => {
      await replyCommentMutation.mutateAsync({ body, id });
    },
    onResolveComment: async (id) => {
      await resolveCommentMutation.mutateAsync(id);
    },
    onUpdateComment: async (id, body) => {
      await updateCommentMutation.mutateAsync({ body, id });
    },
    onUpdateReply: async (commentId, replyId, body) => {
      await updateReplyMutation.mutateAsync({ body, commentId, replyId });
    },
  };
};
