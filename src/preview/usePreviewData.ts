import { useEffect, useState } from "react";
import {
  createComment,
  createReply,
  deleteComment,
  deleteReply,
  loadComments,
  type PreviewComment,
  reopenComment,
  resolveComment,
  updateComment,
  updateReply,
} from "./comments";

export type PreviewDocument = {
  fileUrl: string;
  markdown: string;
  title: string;
};

export type PreviewLoadState =
  | { status: "loading" }
  | {
    comments: PreviewComment[];
    document: PreviewDocument;
    status: "loaded";
  }
  | { message: string; status: "error" };

const loadPreviewDocument = async (): Promise<PreviewDocument> => {
  const response = await fetch("/__sadoku/document");
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};

export const usePreviewData = () => {
  const [state, setState] = useState<PreviewLoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPreviewDocument(), loadComments()])
      .then(([document, commentsDocument]) => {
        if (cancelled) return;
        globalThis.document.title = document.title;
        setState({
          comments: commentsDocument.comments,
          document,
          status: "loaded",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          message: error instanceof Error ? error.message : String(error),
          status: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const replaceComment = (comment: PreviewComment) => {
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.map((existing) =>
          existing.id === comment.id ? comment : existing
        ),
      };
    });
  };

  const handleCreateComment = async (
    startLine: number,
    body: string,
    endLine: number,
  ): Promise<void> => {
    const comment = await createComment(startLine, body, endLine);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return { ...current, comments: [...current.comments, comment] };
    });
  };

  const handleUpdateComment = async (
    id: number,
    body: string,
  ): Promise<void> => replaceComment(await updateComment(id, body));

  const handleReplyComment = async (
    id: number,
    body: string,
  ): Promise<void> => replaceComment(await createReply(id, body));

  const handleDeleteComment = async (id: number): Promise<void> => {
    await deleteComment(id);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.filter((comment) => comment.id !== id),
      };
    });
  };

  const handleUpdateReply = async (
    commentId: number,
    replyId: number,
    body: string,
  ): Promise<void> =>
    replaceComment(await updateReply(commentId, replyId, body));

  const handleDeleteReply = async (
    commentId: number,
    replyId: number,
  ): Promise<void> => {
    await deleteReply(commentId, replyId);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.map((comment) =>
          comment.id === commentId
            ? {
              ...comment,
              replies: (comment.replies ?? []).filter((reply) =>
                reply.id !== replyId
              ),
            }
            : comment
        ),
      };
    });
  };

  const handleResolveComment = async (id: number): Promise<void> =>
    replaceComment(await resolveComment(id));

  const handleReopenComment = async (id: number): Promise<void> =>
    replaceComment(await reopenComment(id));

  return {
    handleCreateComment,
    handleDeleteComment,
    handleDeleteReply,
    handleReopenComment,
    handleReplyComment,
    handleResolveComment,
    handleUpdateComment,
    handleUpdateReply,
    state,
  };
};
