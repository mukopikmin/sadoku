import {
  Button,
  Container,
  Heading,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { CommentListPage } from "./pages/comments/CommentList";
import { MarkdownPreviewPage } from "./pages/markdown/MarkdownPreview";
import {
  PreviewHeader,
  PreviewShell,
  type PreviewView,
} from "./components/layout/PreviewHeader";
import { previewThemeCss } from "./theme";
import { useHotReload } from "./hooks/useHotReload";
import {
  useCommentsQuery,
  useDocumentsQuery,
  usePreviewDocumentQuery,
} from "./hooks/usePreviewData";
import { usePreviewSettings } from "./hooks/usePreviewSettings";
import { isUnresolvedComment } from "./models/comment";
import { SettingsDialog } from "./components/SettingsDialog";

export const App = () => {
  const documentsQuery = useDocumentsQuery();
  const [documentId, setDocumentId] = useState<number>();
  const directoryMode = documentsQuery.data !== null &&
    documentsQuery.data !== undefined;
  const showingDocument = !directoryMode || documentId !== undefined;
  const documentQuery = usePreviewDocumentQuery(
    documentId,
    documentsQuery.isSuccess && showingDocument,
  );
  const commentsQuery = useCommentsQuery(
    documentId,
    documentsQuery.isSuccess && showingDocument,
  );
  const [view, setView] = useState<PreviewView>("preview");
  const settingsDisclosure = useDisclosure();
  const { changeCodeWrapMode, changeThemeMode, codeWrapMode, themeMode } =
    usePreviewSettings();
  const { clearReloadAvailable, reloadAvailable } = useHotReload(documentId);

  const selectDocument = (id?: number) => {
    setView("preview");
    clearReloadAvailable();
    setDocumentId(id);
  };
  const reloadPreview = async () => {
    const [documentResult, commentsResult] = await Promise.all([
      documentQuery.refetch(),
      commentsQuery.refetch(),
    ]);
    if (documentResult.isSuccess && commentsResult.isSuccess) {
      clearReloadAvailable();
    }
  };
  useEffect(() => {
    if (documentQuery.data) {
      globalThis.document.title = documentQuery.data.title;
    }
  }, [documentQuery.data]);

  if (!documentsQuery.isSuccess) {
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>
          {documentsQuery.error
            ? String(documentsQuery.error)
            : "Loading preview..."}
        </PreviewShell>
      </>
    );
  }
  if (directoryMode && documentId === undefined) {
    const documents = documentsQuery.data!;
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>
          <Heading size="lg">Documents</Heading>
        </PreviewShell>
        <Container as="main" maxW="980px" px="8" pb="16">
          {documents.length === 0
            ? <Text color="fg.muted">No Markdown documents found.</Text>
            : (
              <Stack as="ul" gap="2" align="stretch">
                {documents.map((document) => (
                  <li key={document.id}>
                    <Button
                      variant="ghost"
                      justifyContent="flex-start"
                      width="full"
                      onClick={() => selectDocument(document.id)}
                    >
                      {document.relativePath}
                    </Button>
                  </li>
                ))}
              </Stack>
            )}
        </Container>
      </>
    );
  }
  if (!documentQuery.data || !commentsQuery.data) {
    const error = documentQuery.error ?? commentsQuery.error;
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>
          {directoryMode && (
            <Button
              variant="ghost"
              onClick={() => selectDocument()}
            >
              ← Documents
            </Button>
          )}
          {error
            ? error instanceof Error ? error.message : String(error)
            : "Loading preview..."}
        </PreviewShell>
      </>
    );
  }

  const { comments } = commentsQuery.data;
  const document = documentQuery.data;
  return (
    <>
      <style>{previewThemeCss}</style>
      <PreviewHeader
        fileUrl={document.fileUrl}
        onBackToDocuments={directoryMode ? () => selectDocument() : undefined}
        onChangeView={setView}
        onReloadPreview={reloadPreview}
        onOpenSettings={settingsDisclosure.onOpen}
        reloadAvailable={reloadAvailable}
        reloading={documentQuery.isFetching || commentsQuery.isFetching}
        staleCommentCount={comments.filter((comment) =>
          comment.state === "stale"
        ).length}
        title={document.title}
        unresolvedCommentCount={comments.filter(isUnresolvedComment).length}
        view={view}
      />
      <SettingsDialog
        codeWrapMode={codeWrapMode}
        onCodeWrapModeChange={changeCodeWrapMode}
        onOpenChange={settingsDisclosure.setOpen}
        onThemeModeChange={changeThemeMode}
        open={settingsDisclosure.open}
        themeMode={themeMode}
      />
      <Container as="main" maxW="980px" px="8" pt="0" pb="16">
        {view === "preview"
          ? (
            <MarkdownPreviewPage
              key={`${documentId ?? "single"}-${themeMode}`}
              documentId={documentId}
              markdown={document.markdown}
              theme={themeMode === "dark" ? "dark" : "default"}
            />
          )
          : (
            <CommentListPage
              key={documentId ?? "single"}
              documentId={documentId}
            />
          )}
      </Container>
    </>
  );
};
