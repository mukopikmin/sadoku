import {
  Alert,
  Button,
  Container,
  Heading,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
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
  useDirectoryStatusQuery,
  useDocumentsQuery,
  usePreviewDocumentQuery,
} from "./hooks/usePreviewData";
import { usePreviewSettings } from "./hooks/usePreviewSettings";
import { isUnresolvedComment } from "./models/comment";
import { SettingsDialog } from "./components/SettingsDialog";
import { DocumentTree } from "./components/DocumentTree";
import { DocumentBreadcrumb } from "./components/DocumentBreadcrumb";
import { StatisticsDialog } from "./components/StatisticsDialog";
import { useScrollPosition } from "./hooks/useScrollPosition";
import { DocumentInstructionsDialog } from "./components/DocumentInstructionsDialog";
import { DocumentActionBar } from "./components/DocumentActionBar";
import { DocumentTagsDialog } from "./components/DocumentTagsDialog";
import { TagsDialog } from "./components/TagsDialog";

export const App = () => {
  const tagsTriggerRef = useRef<HTMLButtonElement>(null);
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
  const directoryStatusQuery = useDirectoryStatusQuery();
  const directoryStatus = directoryStatusQuery.data;
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
  const saveScrollPosition = useScrollPosition(
    selectedDocumentId,
    view,
    Boolean(documentQuery.data && commentsQuery.data),
  );
  const settingsDisclosure = useDisclosure();
  const statisticsDisclosure = useDisclosure();
  const instructionsDisclosure = useDisclosure();
  const tagsDisclosure = useDisclosure();
  const documentTagsDisclosure = useDisclosure();
  const [connectionLost, setConnectionLost] = useState(false);
  const [showHtmlComments, setShowHtmlComments] = useState(true);
  const {
    changeCodeWrapMode,
    changeDirectoryLimits,
    changeExcludedDirectories,
    changeFontScale,
    changeMarkdownExtensions,
    changeThemeMode,
    settings,
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
    saveScrollPosition();
    void navigate({
      to: nextView === "comments"
        ? "/documents/$documentId/comments"
        : "/documents/$documentId",
      params: { documentId: String(selectedDocumentId) },
    });
  };

  const selectDocument = (id: number) => {
    saveScrollPosition();
    void navigate({
      to: "/documents/$documentId",
      params: { documentId: String(id) },
    });
  };

  const selectDocuments = () => {
    saveScrollPosition();
    void navigate({ to: "/" });
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

  useEffect(() => {
    if (directoryStatus?.state === "ready") void documentsQuery.refetch();
  }, [directoryStatus?.state]);

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
          onOpenStatistics={statisticsDisclosure.onOpen}
          onOpenTags={tagsDisclosure.onOpen}
          tagsTriggerRef={tagsTriggerRef}
          onReloadPreview={reloadPreview}
          reloadAvailable={false}
          reloading={false}
          staleCommentCount={0}
          title="Documents"
          unresolvedCommentCount={0}
          view="preview"
          viewsDisabled
        />
        <StatisticsDialog
          onOpenChange={statisticsDisclosure.setOpen}
          open={statisticsDisclosure.open}
        />
        <TagsDialog
          finalFocusRef={tagsTriggerRef}
          onOpenChange={tagsDisclosure.setOpen}
          open={tagsDisclosure.open}
        />
        <SettingsDialog
          onCodeWrapModeChange={changeCodeWrapMode}
          onDirectoryLimitsChange={changeDirectoryLimits}
          onExcludedDirectoriesChange={changeExcludedDirectories}
          onFontScaleChange={changeFontScale}
          onMarkdownExtensionsChange={changeMarkdownExtensions}
          onOpenChange={settingsDisclosure.setOpen}
          onThemeModeChange={changeThemeMode}
          open={settingsDisclosure.open}
          settings={settings}
        />
        <Container as="main" maxW="980px" px="8" pb="16">
          <Heading mb="4" size="md">Documents</Heading>
          {directoryStatus?.state === "loading"
            ? (
              <Alert.Root status="info">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>ドキュメントを検出しています</Alert.Title>
                  <Alert.Description>
                    検出 {directoryStatus.detected} 件・登録{" "}
                    {directoryStatus.registered} 件
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )
            : directoryStatus?.state === "error"
            ? (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>ドキュメントを読み込めませんでした</Alert.Title>
                  <Alert.Description>
                    {directoryStatus.error?.message}
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )
            : documents!.length === 0
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
          onOpenStatistics={statisticsDisclosure.onOpen}
          onOpenTags={tagsDisclosure.onOpen}
          tagsTriggerRef={tagsTriggerRef}
          onReloadPreview={reloadPreview}
          reloadAvailable={false}
          reloading={false}
          staleCommentCount={0}
          title={selectedDocument?.relativePath ?? "Preview"}
          unresolvedCommentCount={0}
          view="preview"
          viewsDisabled
        />
        <StatisticsDialog
          onOpenChange={statisticsDisclosure.setOpen}
          open={statisticsDisclosure.open}
        />
        <TagsDialog
          finalFocusRef={tagsTriggerRef}
          onOpenChange={tagsDisclosure.setOpen}
          open={tagsDisclosure.open}
        />
        <SettingsDialog
          onCodeWrapModeChange={changeCodeWrapMode}
          onDirectoryLimitsChange={changeDirectoryLimits}
          onExcludedDirectoriesChange={changeExcludedDirectories}
          onFontScaleChange={changeFontScale}
          onMarkdownExtensionsChange={changeMarkdownExtensions}
          onOpenChange={settingsDisclosure.setOpen}
          onThemeModeChange={changeThemeMode}
          open={settingsDisclosure.open}
          settings={settings}
        />
        <Container as="main" maxW="980px" px="8" pb="16">
          {directoryMode && selectedDocument && (
            <DocumentBreadcrumb
              document={selectedDocument}
              documents={documents!}
              onSelectDocument={selectDocument}
              onSelectDocuments={selectDocuments}
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
        onOpenStatistics={statisticsDisclosure.onOpen}
        onOpenTags={tagsDisclosure.onOpen}
        tagsTriggerRef={tagsTriggerRef}
        reloadAvailable={reloadAvailable}
        reloading={documentQuery.isFetching || commentsQuery.isFetching}
        staleCommentCount={staleCommentCount}
        title={document.title}
        unresolvedCommentCount={unresolvedCommentCount}
        view={view}
      />
      <StatisticsDialog
        onOpenChange={statisticsDisclosure.setOpen}
        open={statisticsDisclosure.open}
      />
      <TagsDialog
        finalFocusRef={tagsTriggerRef}
        onOpenChange={tagsDisclosure.setOpen}
        open={tagsDisclosure.open}
      />
      <DocumentInstructionsDialog
        documentId={selectedDocumentId}
        onOpenChange={instructionsDisclosure.setOpen}
        open={instructionsDisclosure.open}
      />
      <DocumentTagsDialog
        documentId={selectedDocumentId}
        onOpenChange={documentTagsDisclosure.setOpen}
        open={documentTagsDisclosure.open}
        tags={document.tags ?? []}
      />
      <SettingsDialog
        onCodeWrapModeChange={changeCodeWrapMode}
        onDirectoryLimitsChange={changeDirectoryLimits}
        onExcludedDirectoriesChange={changeExcludedDirectories}
        onFontScaleChange={changeFontScale}
        onMarkdownExtensionsChange={changeMarkdownExtensions}
        onOpenChange={settingsDisclosure.setOpen}
        onThemeModeChange={changeThemeMode}
        open={settingsDisclosure.open}
        settings={settings}
      />
      <Container as="main" maxW="980px" px="8" pt="0" pb="16">
        {directoryMode && selectedDocument && (
          <DocumentBreadcrumb
            document={selectedDocument}
            documents={documents!}
            onSelectDocument={selectDocument}
            onSelectDocuments={selectDocuments}
          />
        )}
        {view === "preview" && (
          <DocumentActionBar
            markdown={document.markdown}
            onOpenInstructions={instructionsDisclosure.onOpen}
            onToggleHtmlComments={() => setShowHtmlComments((shown) => !shown)}
            showHtmlComments={showHtmlComments}
            onOpenTags={documentTagsDisclosure.onOpen}
            tags={document.tags ?? []}
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
              documentPath={selectedDocument?.relativePath ??
                document.fileUrl ?? document.title}
              key={`${selectedDocumentId}-${settings.theme}-${settings.fontScale}`}
              markdown={document.markdown}
              showHtmlComments={showHtmlComments}
              theme={settings.theme === "dark" ? "dark" : "default"}
            />
          )
          : <CommentListPage documentId={selectedDocumentId} />}
      </Container>
    </>
  );
};
