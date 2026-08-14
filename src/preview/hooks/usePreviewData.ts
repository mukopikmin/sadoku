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
import { loadDocuments, loadPreviewDocument } from "../api/document";

export const documentsQueryKey = ["documents"] as const;
export const previewDocumentQueryKey = (documentId?: number) =>
  ["preview-document", documentId] as const;
export const commentsQueryKey = (documentId?: number) =>
  ["comments", documentId] as const;
export const useDocumentsQuery = () =>
  useQuery({ queryFn: loadDocuments, queryKey: documentsQueryKey });

export const usePreviewDocumentQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadPreviewDocument(documentId),
    queryKey: previewDocumentQueryKey(documentId),
  });

export const useCommentsQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadComments(documentId),
    queryKey: commentsQueryKey(documentId),
  });

export const useCommentActions = (documentId?: number): CommentActions => {
  const queryClient = useQueryClient();

  const updateComments = (
    updater: (current: Comment[]) => Comment[],
  ) => {
    queryClient.setQueryData<CommentsDocument>(
      commentsQueryKey(documentId),
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
    }) => createComment(startLine, body, endLine, documentId),
    onSuccess: (created) => {
      updateComments((comments) => [...comments, created]);
    },
  });
  const updateCommentMutation = useMutation({
    mutationFn: ({ body, id }: { body: string; id: number }) =>
      updateComment(id, body, documentId),
    onSuccess: replaceComment,
  });
  const replyCommentMutation = useMutation({
    mutationFn: ({ body, id }: { body: string; id: number }) =>
      createReply(id, body, documentId),
    onSuccess: replaceComment,
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (id: number) => deleteComment(id, documentId),
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
    }) => updateReply(commentId, replyId, body, documentId),
    onSuccess: replaceComment,
  });
  const deleteReplyMutation = useMutation({
    mutationFn: ({
      commentId,
      replyId,
    }: {
      commentId: number;
      replyId: number;
    }) => deleteReply(commentId, replyId, documentId),
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
    mutationFn: (id: number) => resolveComment(id, documentId),
    onSuccess: replaceComment,
  });
  const reopenCommentMutation = useMutation({
    mutationFn: (id: number) => reopenComment(id, documentId),
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
