import {
  Alert,
  Button,
  Container,
  Heading,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  Link as RouterLink,
  useMatchRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { CommentListPage } from "./pages/comments/CommentList";
import { MarkdownPreviewPage } from "./pages/markdown/MarkdownPreview";
import {
  PreviewHeader,
  PreviewShell,
  type PreviewView,
} from "./components/layout/PreviewHeader";
import { previewThemeCss } from "./theme";
import { useHotReload } from "./hooks/useHotReload";
import { connectPreviewKeepAlive } from "./api/hotReload";
import {
  useCommentsQuery,
  useDocumentsQuery,
  usePreviewDocumentQuery,
} from "./hooks/usePreviewData";
import { usePreviewSettings } from "./hooks/usePreviewSettings";
import { isUnresolvedComment } from "./models/comment";
import { SettingsDialog } from "./components/SettingsDialog";
import { DocumentTree } from "./components/DocumentTree";
import { DocumentBreadcrumb } from "./components/DocumentBreadcrumb";

export const App = () => {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const commentsMatch = matchRoute({
    to: "/documents/$documentId/comments",
  });
  const previewMatch = matchRoute({ to: "/documents/$documentId" });
  const rawDocumentId = commentsMatch
    ? commentsMatch.documentId
    : previewMatch
    ? previewMatch.documentId
    : undefined;
  const parsedDocumentId = rawDocumentId && /^[1-9]\d*$/.test(rawDocumentId)
    ? Number(rawDocumentId)
    : undefined;
  const routeDocumentId = Number.isSafeInteger(parsedDocumentId)
    ? parsedDocumentId
    : undefined;
  const documentsQuery = useDocumentsQuery();
  const documents = documentsQuery.data;
  const directoryMode = documents !== null && documents !== undefined;
  const selectedDocumentId = routeDocumentId;
  const shouldLoadDocument = documentsQuery.isSuccess &&
    (!directoryMode || selectedDocumentId !== undefined);
  const documentQuery = usePreviewDocumentQuery(
    selectedDocumentId,
    shouldLoadDocument,
  );
  const commentsQuery = useCommentsQuery(
    selectedDocumentId,
    shouldLoadDocument,
  );
  const view: PreviewView = commentsMatch ? "comments" : "preview";
  const settingsDisclosure = useDisclosure();
  const [connectionLost, setConnectionLost] = useState(false);
  const {
    changeCodeWrapMode,
    changeDirectoryLimits,
    changeFontScale,
    changeThemeMode,
    codeWrapMode,
    fontScale,
    maxDepth,
    maxFiles,
    themeMode,
  } = usePreviewSettings();
  const { clearReloadAvailable, reloadAvailable } = useHotReload(
    selectedDocumentId,
  );

  useEffect(() =>
    connectPreviewKeepAlive({
      onConnectionLost: () => setConnectionLost(true),
      onConnectionRestored: () => setConnectionLost(false),
    }), []);

  useEffect(() => {
    clearReloadAvailable();
  }, [selectedDocumentId]);

  const changeView = (nextView: PreviewView) => {
    if (nextView === view || selectedDocumentId === undefined) return;
    void navigate({
      to: nextView === "comments"
        ? "/documents/$documentId/comments"
        : "/documents/$documentId",
      params: { documentId: String(selectedDocumentId) },
    });
  };

  const selectDocument = (id: number) => {
    void navigate({
      to: "/documents/$documentId",
      params: { documentId: String(id) },
    });
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
    if (pathname === "/") {
      globalThis.document.title = "Documents — Sadoku";
    } else if (documentQuery.data) {
      globalThis.document.title = view === "comments"
        ? `Comments — ${documentQuery.data.title} — Sadoku`
        : `${documentQuery.data.title} — Sadoku`;
    }
  }, [documentQuery.data, pathname, view]);

  if (documentsQuery.isPending) {
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>Loading preview...</PreviewShell>
      </>
    );
  }
  if (documentsQuery.error) {
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>{String(documentsQuery.error)}</PreviewShell>
      </>
    );
  }
  const routeIsList = pathname === "/";
  const selectedDocumentExists = selectedDocumentId !== undefined &&
    documents?.some((document) => document.id === selectedDocumentId);
  if (!routeIsList && (!rawDocumentId || !selectedDocumentExists)) {
    globalThis.document.title = "Not Found — Sadoku";
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewShell>
          <Text fontWeight="semibold">Document not found.</Text>
        </PreviewShell>
        <Container as="main" maxW="980px" px="8" pb="16">
          <Button asChild variant="outline">
            <RouterLink to="/">Back to documents</RouterLink>
          </Button>
        </Container>
      </>
    );
  }
  if (selectedDocumentId === undefined) {
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewHeader
          connectionLost={connectionLost}
          onChangeView={() => {}}
          onOpenSettings={settingsDisclosure.onOpen}
          onReloadPreview={reloadPreview}
          reloadAvailable={false}
          reloading={false}
          staleCommentCount={0}
          title="Documents"
          unresolvedCommentCount={0}
          view="preview"
          viewsDisabled
        />
        <SettingsDialog
          codeWrapMode={codeWrapMode}
          fontScale={fontScale}
          maxDepth={maxDepth}
          maxFiles={maxFiles}
          onCodeWrapModeChange={changeCodeWrapMode}
          onDirectoryLimitsChange={changeDirectoryLimits}
          onFontScaleChange={changeFontScale}
          onOpenChange={settingsDisclosure.setOpen}
          onThemeModeChange={changeThemeMode}
          open={settingsDisclosure.open}
          themeMode={themeMode}
        />
        <Container as="main" maxW="980px" px="8" pb="16">
          <Heading mb="4" size="md">Documents</Heading>
          {documents!.length === 0
            ? <Text color="fg.muted">No Markdown documents found.</Text>
            : (
              <DocumentTree
                documents={documents!}
                onSelectDocument={selectDocument}
              />
            )}
        </Container>
      </>
    );
  }

  if (!documentQuery.data || !commentsQuery.data) {
    const error = documentQuery.error ?? commentsQuery.error;
    const selectedDocument = documents?.find((item) =>
      item.id === selectedDocumentId
    );
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewHeader
          connectionLost={connectionLost}
          onChangeView={changeView}
          onOpenSettings={settingsDisclosure.onOpen}
          onReloadPreview={reloadPreview}
          reloadAvailable={false}
          reloading={false}
          staleCommentCount={0}
          title={selectedDocument?.relativePath ?? "Preview"}
          unresolvedCommentCount={0}
          view="preview"
          viewsDisabled
        />
        <SettingsDialog
          codeWrapMode={codeWrapMode}
          fontScale={fontScale}
          maxDepth={maxDepth}
          maxFiles={maxFiles}
          onCodeWrapModeChange={changeCodeWrapMode}
          onDirectoryLimitsChange={changeDirectoryLimits}
          onFontScaleChange={changeFontScale}
          onOpenChange={settingsDisclosure.setOpen}
          onThemeModeChange={changeThemeMode}
          open={settingsDisclosure.open}
          themeMode={themeMode}
        />
        <Container as="main" maxW="980px" px="8" pb="16">
          {directoryMode && selectedDocument && (
            <DocumentBreadcrumb
              document={selectedDocument}
              documents={documents!}
              onSelectDocument={selectDocument}
              onSelectDocuments={() => void navigate({ to: "/" })}
            />
          )}
          <Text color={error ? "fg.error" : "fg.muted"}>
            {error
              ? error instanceof Error ? error.message : String(error)
              : "Loading preview..."}
          </Text>
        </Container>
      </>
    );
  }

  const { comments } = commentsQuery.data;
  const document = documentQuery.data;
  const selectedDocument = documents?.find((item) =>
    item.id === selectedDocumentId
  );
  const staleCommentCount =
    comments.filter((comment) => comment.state === "stale").length;
  const unresolvedCommentCount = comments.filter(isUnresolvedComment).length;

  return (
    <>
      <style>{previewThemeCss}</style>
      <PreviewHeader
        connectionLost={connectionLost}
        fileUrl={document.fileUrl}
        onChangeView={changeView}
        onReloadPreview={reloadPreview}
        onOpenSettings={settingsDisclosure.onOpen}
        reloadAvailable={reloadAvailable}
        reloading={documentQuery.isFetching || commentsQuery.isFetching}
        staleCommentCount={staleCommentCount}
        title={document.title}
        unresolvedCommentCount={unresolvedCommentCount}
        view={view}
      />
      <SettingsDialog
        codeWrapMode={codeWrapMode}
        fontScale={fontScale}
        maxDepth={maxDepth}
        maxFiles={maxFiles}
        onCodeWrapModeChange={changeCodeWrapMode}
        onDirectoryLimitsChange={changeDirectoryLimits}
        onFontScaleChange={changeFontScale}
        onOpenChange={settingsDisclosure.setOpen}
        onThemeModeChange={changeThemeMode}
        open={settingsDisclosure.open}
        themeMode={themeMode}
      />
      <Container as="main" maxW="980px" px="8" pt="0" pb="16">
        {directoryMode && selectedDocument && (
          <DocumentBreadcrumb
            document={selectedDocument}
            documents={documents!}
            onSelectDocument={selectDocument}
            onSelectDocuments={() => void navigate({ to: "/" })}
          />
        )}
        {document.deleted && (
          <Alert.Root status="warning" mb="6">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Deleted document</Alert.Title>
              <Alert.Description>
                The original file no longer exists. A saved snapshot is being
                shown instead.
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
        {view === "preview"
          ? (
            <MarkdownPreviewPage
              documentId={selectedDocumentId}
              key={`${selectedDocumentId}-${themeMode}-${fontScale}`}
              markdown={document.markdown}
              theme={themeMode === "dark" ? "dark" : "default"}
            />
          )
          : <CommentListPage documentId={selectedDocumentId} />}
      </Container>
    </>
  );
};
