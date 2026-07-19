import { Container } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { CommentListPage } from "./pages/comments/CommentList";
import { connectHotReload } from "./hot_reload";
import { MarkdownPreviewPage } from "./pages/markdown/MarkdownPreview";
import { initializeMermaid } from "./markdown/mermaid";
import {
  PreviewHeader,
  PreviewShell,
  type PreviewView,
} from "./components/layout/PreviewHeader";
import { previewThemeCss } from "./theme";
import {
  useCommentsQuery,
  usePreviewDocumentQuery,
} from "./hooks/usePreviewData";
import { useThemeMode } from "./hooks/useThemeMode";

export const App = () => {
  const documentQuery = usePreviewDocumentQuery();
  const commentsQuery = useCommentsQuery();
  const [view, setView] = useState<PreviewView>("preview");
  const { themeMode, toggleThemeMode } = useThemeMode();
  const [reloadAvailable, setReloadAvailable] = useState(false);

  useEffect(() => {
    return connectHotReload({
      onReloadAvailable: () => setReloadAvailable(true),
    });
  }, []);

  useEffect(() => {
    if (!documentQuery.data || !commentsQuery.data || view !== "preview") {
      return;
    }
    initializeMermaid({
      theme: themeMode === "dark" ? "dark" : "default",
    });
  }, [commentsQuery.data, documentQuery.data, themeMode, view]);

  useEffect(() => {
    if (documentQuery.data) {
      globalThis.document.title = documentQuery.data.title;
    }
  }, [documentQuery.data]);

  if (!documentQuery.data || !commentsQuery.data) {
    const error = documentQuery.error ?? commentsQuery.error;
    return (
      <>
        <style>{previewThemeCss}</style>
        <Container as="main" maxW="980px" px="8" pt="0" pb="16">
          <PreviewShell>
            {error
              ? error instanceof Error ? error.message : String(error)
              : "Loading preview..."}
          </PreviewShell>
        </Container>
      </>
    );
  }

  const { comments } = commentsQuery.data;
  const document = documentQuery.data;
  const staleCommentCount =
    comments.filter((comment) => !comment.resolved && comment.stale)
      .length;
  const unresolvedCommentCount = comments.filter((comment) => !comment.resolved)
    .length;

  return (
    <>
      <style>{previewThemeCss}</style>
      <Container as="main" maxW="980px" px="8" pt="0" pb="16">
        <PreviewHeader
          fileUrl={document.fileUrl}
          onChangeView={setView}
          onToggleThemeMode={toggleThemeMode}
          reloadAvailable={reloadAvailable}
          staleCommentCount={staleCommentCount}
          themeMode={themeMode}
          title={document.title}
          unresolvedCommentCount={unresolvedCommentCount}
          view={view}
        />
        {view === "preview"
          ? (
            <MarkdownPreviewPage
              key={themeMode}
              markdown={document.markdown}
            />
          )
          : <CommentListPage />}
      </Container>
    </>
  );
};
