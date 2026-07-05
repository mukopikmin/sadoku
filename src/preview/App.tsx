import { Badge, Box, Button, Flex, Tabs, Theme } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import type React from "react";
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
import { CommentList } from "./CommentList";
import { connectHotReload } from "./hot_reload";
import { MarkdownPreview } from "./MarkdownPreview";
import { initializeMermaid } from "./mermaid";
import { previewThemeCss } from "./theme";

type PreviewDocument = {
  fileUrl: string;
  markdown: string;
  title: string;
};

type LoadState =
  | { status: "loading" }
  | {
    comments: PreviewComment[];
    document: PreviewDocument;
    status: "loaded";
  }
  | { message: string; status: "error" };

type View = "comments" | "preview";

const loadPreviewDocument = async (): Promise<PreviewDocument> => {
  const response = await fetch("/__sadoku/document");
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};

const PreviewTheme = ({ children }: { children: React.ReactNode }) => (
  <Theme accentColor="blue" grayColor="slate" radius="medium">
    {children}
  </Theme>
);

export const App = () => {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<View>("preview");
  const [reloadAvailable, setReloadAvailable] = useState(false);

  useEffect(() => {
    return connectHotReload({
      onReloadAvailable: () => setReloadAvailable(true),
    });
  }, []);

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

  useEffect(() => {
    if (state.status !== "loaded" || view !== "preview") return;
    initializeMermaid();
  }, [state, view]);

  const handleCreateComment = async (
    line: number,
    body: string,
  ): Promise<void> => {
    const comment = await createComment(line, body);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: [...current.comments, comment],
      };
    });
  };

  const handleUpdateComment = async (
    id: number,
    body: string,
  ): Promise<void> => {
    const comment = await updateComment(id, body);
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

  const handleReplyComment = async (
    id: number,
    body: string,
  ): Promise<void> => {
    const comment = await createReply(id, body);
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
  ): Promise<void> => {
    const comment = await updateReply(commentId, replyId, body);
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

  const handleResolveComment = async (id: number): Promise<void> => {
    const comment = await resolveComment(id);
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

  const handleReloadPreview = () => {
    globalThis.location.reload();
  };

  const handleReopenComment = async (id: number): Promise<void> => {
    const comment = await reopenComment(id);
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

  if (state.status === "loading") {
    return (
      <PreviewTheme>
        <style>{previewThemeCss}</style>
        <main>
          <header>Loading preview...</header>
        </main>
      </PreviewTheme>
    );
  }

  if (state.status === "error") {
    return (
      <PreviewTheme>
        <style>{previewThemeCss}</style>
        <main>
          <header>{state.message}</header>
        </main>
      </PreviewTheme>
    );
  }

  const activeComments = state.comments.filter((comment) =>
    !comment.resolved && !comment.stale
  );
  const staleCommentCount =
    state.comments.filter((comment) => !comment.resolved && comment.stale)
      .length;

  return (
    <PreviewTheme>
      <style>{previewThemeCss}</style>
      <main>
        <Tabs.Root
          value={view}
          onValueChange={(value) => setView(value as View)}
        >
          <header>
            <Box>
              Previewing{" "}
              <a href={state.document.fileUrl}>{state.document.title}</a>.
              {reloadAvailable && (
                <Flex asChild align="center" gap="2" wrap="wrap">
                  <span className="reload-notice" role="status">
                    Source changes are available.
                    <Button
                      color="amber"
                      onClick={handleReloadPreview}
                      size="1"
                      variant="soft"
                    >
                      Reload preview
                    </Button>
                  </span>
                </Flex>
              )}
            </Box>
            <Tabs.List aria-label="Preview views">
              <Tabs.Trigger onClick={() => setView("preview")} value="preview">
                Preview
              </Tabs.Trigger>
              <Tabs.Trigger
                onClick={() => setView("comments")}
                value="comments"
              >
                Comments {state.comments.length}
                {staleCommentCount > 0 && (
                  <Badge color="amber" ml="2" variant="soft">
                    Stale {staleCommentCount}
                  </Badge>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </header>
          <Tabs.Content value="preview">
            <MarkdownPreview
              comments={activeComments}
              markdown={state.document.markdown}
              onCreateComment={handleCreateComment}
              onDeleteComment={handleDeleteComment}
              onDeleteReply={handleDeleteReply}
              onReplyComment={handleReplyComment}
              onResolveComment={handleResolveComment}
              onUpdateComment={handleUpdateComment}
              onUpdateReply={handleUpdateReply}
            />
          </Tabs.Content>
          <Tabs.Content value="comments">
            <CommentList
              comments={state.comments}
              onDeleteComment={handleDeleteComment}
              onDeleteReply={handleDeleteReply}
              onReplyComment={handleReplyComment}
              onReopenComment={handleReopenComment}
              onResolveComment={handleResolveComment}
              onUpdateComment={handleUpdateComment}
              onUpdateReply={handleUpdateReply}
            />
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </PreviewTheme>
  );
};
