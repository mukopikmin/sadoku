import { Box, Button, Container, Flex, Link, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useState } from "react";
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

const PreviewShell = ({ children }: { children: ReactNode }) => (
  <Container as="main" maxW="980px" px="32px" py="32px" pb="64px">
    <Flex
      as="header"
      position="sticky"
      top="0"
      zIndex="10"
      align="center"
      justify="space-between"
      gap="4"
      mb="8"
      borderBottomWidth="1px"
      borderColor="border.muted"
      pb="4"
      bg="canvas"
      color="fg.muted"
      fontSize="sm"
    >
      {children}
    </Flex>
  </Container>
);

const loadPreviewDocument = async (): Promise<PreviewDocument> => {
  const response = await fetch("/__sadoku/document");
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};

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
    startLine: number,
    body: string,
    endLine: number,
  ): Promise<void> => {
    const comment = await createComment(startLine, body, endLine);
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
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>Loading preview...</PreviewShell>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>{state.message}</PreviewShell>
      </>
    );
  }

  const activeComments = state.comments.filter((comment) =>
    !comment.resolved && !comment.stale
  );
  const staleCommentCount =
    state.comments.filter((comment) => !comment.resolved && comment.stale)
      .length;

  return (
    <>
      <style>{previewThemeCss}</style>
      <Container as="main" maxW="980px" px="32px" py="32px" pb="64px">
        <Flex
          as="header"
          position="sticky"
          top="0"
          zIndex="10"
          align="center"
          justify="space-between"
          gap="4"
          mb="8"
          borderBottomWidth="1px"
          borderColor="border.muted"
          pb="4"
          bg="canvas"
          color="fg.muted"
          fontSize="sm"
        >
          <Text as="div">
            Previewing{" "}
            <Link
              href={state.document.fileUrl}
              color="fg"
              fontWeight="semibold"
            >
              {state.document.title}
            </Link>.
            {reloadAvailable && (
              <Flex
                as="span"
                role="status"
                display="inline-flex"
                wrap="wrap"
                align="center"
                gap="2"
                ml="2"
                color="warning.fg"
              >
                Source changes are available.
                <Button
                  size="xs"
                  variant="outline"
                  colorPalette="yellow"
                  onClick={() => globalThis.location.reload()}
                  type="button"
                >
                  Reload preview
                </Button>
              </Flex>
            )}
          </Text>
          <Flex as="nav" aria-label="Preview views" wrap="wrap" gap="2">
            <Button
              aria-current={view === "preview" ? "page" : undefined}
              colorPalette={view === "preview" ? "blue" : "gray"}
              onClick={() => setView("preview")}
              size="sm"
              type="button"
              variant="outline"
            >
              Preview
            </Button>
            <Button
              aria-current={view === "comments" ? "page" : undefined}
              colorPalette={view === "comments" ? "blue" : "gray"}
              onClick={() => setView("comments")}
              size="sm"
              type="button"
              variant="outline"
            >
              Comments {state.comments.length}
              {staleCommentCount > 0 && (
                <Box as="span" ml="1" color="warning.fg">
                  Stale {staleCommentCount}
                </Box>
              )}
            </Button>
          </Flex>
        </Flex>
        {view === "preview"
          ? (
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
          )
          : (
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
          )}
      </Container>
    </>
  );
};
