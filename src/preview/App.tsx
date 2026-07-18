import { Container } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { CommentList } from "./pages/comments/CommentList";
import { MarkdownPreview } from "./pages/markdown/MarkdownPreview";
import { initializeMermaid } from "./markdown/mermaid";
import {
  PreviewHeader,
  PreviewShell,
  type PreviewView,
} from "./components/layout/PreviewHeader";
import { previewThemeCss } from "./theme";
import { usePreviewData } from "./hooks/usePreviewData";
import { useThemeMode } from "./hooks/useThemeMode";
import { useHotReload } from "./hooks/useHotReload";

export const App = () => {
  const {
    handleCreateComment,
    handleDeleteComment,
    handleDeleteReply,
    handleReopenComment,
    handleReplyComment,
    handleResolveComment,
    handleUpdateComment,
    handleUpdateReply,
    state,
  } = usePreviewData();
  const [view, setView] = useState<PreviewView>("preview");
  const { themeMode, toggleThemeMode } = useThemeMode();
  const { reloadAvailable } = useHotReload();

  useEffect(() => {
    if (state.status !== "loaded" || view !== "preview") return;
    initializeMermaid({
      theme: themeMode === "dark" ? "dark" : "default",
    });
  }, [state, themeMode, view]);

  if (state.status === "loading" || state.status === "error") {
    return (
      <>
        <style>{previewThemeCss}</style>
        <Container as="main" maxW="980px" px="8" pt="0" pb="16">
          <PreviewShell>
            {state.status === "loading" ? "Loading preview..." : state.message}
          </PreviewShell>
        </Container>
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
      <Container as="main" maxW="980px" px="8" pt="0" pb="16">
        <PreviewHeader
          commentCount={state.comments.length}
          fileUrl={state.document.fileUrl}
          onChangeView={setView}
          onToggleThemeMode={toggleThemeMode}
          reloadAvailable={reloadAvailable}
          staleCommentCount={staleCommentCount}
          themeMode={themeMode}
          title={state.document.title}
          view={view}
        />
        {view === "preview"
          ? (
            <MarkdownPreview
              key={themeMode}
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
