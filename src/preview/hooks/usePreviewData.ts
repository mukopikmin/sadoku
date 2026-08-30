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
import { loadDirectoryStatus } from "../api/directoryStatus";
import {
  createInstruction,
  deleteInstruction,
  loadInstructions,
  updateInstruction,
} from "../api/instructions";
import { loadTags, replaceDocumentTags, type TagReference } from "../api/tags";

export const documentsQueryKey = ["documents"] as const;
export const directoryStatusQueryKey = ["directory-status"] as const;
export const previewDocumentQueryKey = (documentId?: number) =>
  ["preview-document", documentId] as const;
export const commentsQueryKey = (documentId?: number) =>
  ["comments", documentId] as const;
export const instructionsQueryKey = (documentId?: number) =>
  ["instructions", documentId] as const;
export const tagsQueryKey = ["tags"] as const;

export const useTagsQuery = () =>
  useQuery({ queryFn: loadTags, queryKey: tagsQueryKey });
export const useTagActions = (documentId: number) => {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tagsQueryKey }),
      queryClient.invalidateQueries({ queryKey: documentsQueryKey }),
      queryClient.invalidateQueries({
        queryKey: previewDocumentQueryKey(documentId),
      }),
    ]);
  };
  const replaceMutation = useMutation({
    mutationFn: (tags: TagReference[]) => replaceDocumentTags(documentId, tags),
    onSuccess: refresh,
  });
  return {
    pending: replaceMutation.isPending,
    replace: replaceMutation.mutateAsync,
  };
};

export const useInstructionsQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadInstructions(documentId!),
    queryKey: instructionsQueryKey(documentId),
  });

export const useInstructionActions = (documentId: number) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: instructionsQueryKey(documentId),
    });
  const createMutation = useMutation({
    mutationFn: (content: string) => createInstruction(documentId, content),
    onSuccess: refresh,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateInstruction(documentId, id, content),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInstruction(documentId, id),
    onSuccess: refresh,
  });
  return {
    create: createMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    pending: createMutation.isPending || updateMutation.isPending ||
      deleteMutation.isPending,
    update: updateMutation.mutateAsync,
  };
};

export const useDocumentsQuery = () =>
  useQuery({
    queryFn: loadDocuments,
    queryKey: documentsQueryKey,
  });

export const useDirectoryStatusQuery = () =>
  useQuery({
    queryFn: loadDirectoryStatus,
    queryKey: directoryStatusQueryKey,
    refetchInterval: (query) =>
      query.state.data?.state === "loading" ? 250 : false,
  });

export const usePreviewDocumentQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadPreviewDocument(documentId!),
    queryKey: previewDocumentQueryKey(documentId),
  });

export const useCommentsQuery = (documentId?: number, enabled = true) =>
  useQuery({
    enabled,
    queryFn: () => loadComments(documentId!),
    queryKey: commentsQueryKey(documentId),
  });

export const useCommentActions = (documentId?: number): CommentActions => {
  const queryClient = useQueryClient();

  const updateComments = (
    updater: (current: Comment[]) => Comment[],
    targetDocumentId = documentId,
  ) => {
    queryClient.setQueryData<CommentsDocument>(
      commentsQueryKey(targetDocumentId),
      (current) =>
        current && {
          ...current,
          comments: updater(current.comments),
        },
    );
  };
  const replaceComment = (updated: Comment, targetDocumentId = documentId) => {
    updateComments(
      (comments) =>
        comments.map((comment) =>
          comment.id === updated.id ? updated : comment
        ),
      targetDocumentId,
    );
  };

  const createCommentMutation = useMutation({
    mutationFn: ({
      body,
      endLine,
      startLine,
      targetDocumentId,
    }: {
      body: string;
      endLine: number;
      startLine: number;
      targetDocumentId: number | undefined;
    }) => createComment(startLine, body, endLine, targetDocumentId),
    onSuccess: (created, { targetDocumentId }) => {
      updateComments((comments) => [...comments, created], targetDocumentId);
    },
  });
  const updateCommentMutation = useMutation({
    mutationFn: (
      { body, id, targetDocumentId }: {
        body: string;
        id: number;
        targetDocumentId?: number;
      },
    ) => updateComment(id, body, targetDocumentId),
    onSuccess: (updated, { targetDocumentId }) =>
      replaceComment(updated, targetDocumentId),
  });
  const replyCommentMutation = useMutation({
    mutationFn: (
      { body, id, targetDocumentId }: {
        body: string;
        id: number;
        targetDocumentId?: number;
      },
    ) => createReply(id, body, targetDocumentId),
    onSuccess: (updated, { targetDocumentId }) =>
      replaceComment(updated, targetDocumentId),
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (
      { id, targetDocumentId }: { id: number; targetDocumentId?: number },
    ) => deleteComment(id, targetDocumentId),
    onSuccess: (_data, { id, targetDocumentId }) => {
      updateComments(
        (comments) => comments.filter((comment) => comment.id !== id),
        targetDocumentId,
      );
    },
  });
  const updateReplyMutation = useMutation({
    mutationFn: ({
      body,
      commentId,
      replyId,
      targetDocumentId,
    }: {
      body: string;
      commentId: number;
      replyId: number;
      targetDocumentId?: number;
    }) => updateReply(commentId, replyId, body, targetDocumentId),
    onSuccess: (updated, { targetDocumentId }) =>
      replaceComment(updated, targetDocumentId),
  });
  const deleteReplyMutation = useMutation({
    mutationFn: ({
      commentId,
      replyId,
      targetDocumentId,
    }: {
      commentId: number;
      replyId: number;
      targetDocumentId?: number;
    }) => deleteReply(commentId, replyId, targetDocumentId),
    onSuccess: (_data, { commentId, replyId, targetDocumentId }) => {
      updateComments(
        (comments) =>
          comments.map((comment) =>
            comment.id === commentId
              ? {
                ...comment,
                replies: (comment.replies ?? []).filter((reply) =>
                  reply.id !== replyId
                ),
              }
              : comment
          ),
        targetDocumentId,
      );
    },
  });
  const resolveCommentMutation = useMutation({
    mutationFn: (
      { id, targetDocumentId }: { id: number; targetDocumentId?: number },
    ) => resolveComment(id, targetDocumentId),
    onSuccess: (updated, { targetDocumentId }) =>
      replaceComment(updated, targetDocumentId),
  });
  const reopenCommentMutation = useMutation({
    mutationFn: (
      { id, targetDocumentId }: { id: number; targetDocumentId?: number },
    ) => reopenComment(id, targetDocumentId),
    onSuccess: (updated, { targetDocumentId }) =>
      replaceComment(updated, targetDocumentId),
  });

  return {
    onCreateComment: async (startLine, body, endLine) => {
      await createCommentMutation.mutateAsync({
        body,
        endLine,
        startLine,
        targetDocumentId: documentId,
      });
    },
    onDeleteComment: async (id) => {
      await deleteCommentMutation.mutateAsync({
        id,
        targetDocumentId: documentId,
      });
    },
    onDeleteReply: async (commentId, replyId) => {
      await deleteReplyMutation.mutateAsync({
        commentId,
        replyId,
        targetDocumentId: documentId,
      });
    },
    onReopenComment: async (id) => {
      await reopenCommentMutation.mutateAsync({
        id,
        targetDocumentId: documentId,
      });
    },
    onReplyComment: async (id, body) => {
      await replyCommentMutation.mutateAsync({
        body,
        id,
        targetDocumentId: documentId,
      });
    },
    onResolveComment: async (id) => {
      await resolveCommentMutation.mutateAsync({
        id,
        targetDocumentId: documentId,
      });
    },
    onUpdateComment: async (id, body) => {
      await updateCommentMutation.mutateAsync({
        body,
        id,
        targetDocumentId: documentId,
      });
    },
    onUpdateReply: async (commentId, replyId, body) => {
      await updateReplyMutation.mutateAsync({
        body,
        commentId,
        replyId,
        targetDocumentId: documentId,
      });
    },
  };
};
