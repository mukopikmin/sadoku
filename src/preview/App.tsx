import { Button, Container, Text, useDisclosure } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import {
  PreviewShell,
  type PreviewView,
} from "./components/layout/PreviewHeader";
import { markdownStyles } from "./markdown/markdownStyles";
import { useHotReload } from "./hooks/useHotReload";
import { connectPreviewKeepAlive } from "./api/hotReload";
import { useCommentsQuery } from "./hooks/useComments";
import {
  useDirectoryStatusQuery,
  useDocumentsQuery,
  usePreviewDocumentQuery,
} from "./hooks/useDocuments";
import { useInstructionsQuery } from "./hooks/useInstructions";
import { usePreviewSettings } from "./hooks/usePreviewSettings";
import { useScrollPosition } from "./hooks/useScrollPosition";
import { DocumentListPage } from "./pages/DocumentListPage";
import { DocumentLoadingPage } from "./pages/DocumentLoadingPage";
import { DocumentPreviewPage } from "./pages/DocumentPreviewPage";
import { PreviewLayout } from "./components/layout/PreviewLayout";
import { usePreviewRoute } from "./hooks/usePreviewRoute";
import { isUnresolvedComment } from "./models/comment";

export const App = () => {
  const tagsTriggerRef = useRef<HTMLButtonElement>(null);
  const {
    documentId: selectedDocumentId,
    isDocumentList,
    pathname,
    rawDocumentId,
    view,
  } = usePreviewRoute();
  const navigate = useNavigate();
  const documentsQuery = useDocumentsQuery();
  const directoryStatusQuery = useDirectoryStatusQuery();
  const directoryStatus = directoryStatusQuery.data;
  const documents = documentsQuery.data;
  const directoryMode = documents !== null && documents !== undefined;
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
  const instructionsQuery = useInstructionsQuery(
    selectedDocumentId,
    shouldLoadDocument,
  );
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
  const settingsActions = {
    onCodeWrapModeChange: changeCodeWrapMode,
    onDirectoryLimitsChange: changeDirectoryLimits,
    onExcludedDirectoriesChange: changeExcludedDirectories,
    onFontScaleChange: changeFontScale,
    onMarkdownExtensionsChange: changeMarkdownExtensions,
    onThemeModeChange: changeThemeMode,
  };

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

  const dialogProps = {
    documentInstructions: instructionsDisclosure,
    documentTagsDialog: documentTagsDisclosure,
    settings,
    settingsActions,
    settingsDialog: settingsDisclosure,
    statisticsDialog: statisticsDisclosure,
    tagsDialog: tagsDisclosure,
    tagsTriggerRef,
  };
  const headerActions = {
    connectionLost,
    onOpenSettings: settingsDisclosure.onOpen,
    onOpenStatistics: statisticsDisclosure.onOpen,
    onOpenTags: tagsDisclosure.onOpen,
    onReloadPreview: reloadPreview,
    tagsTriggerRef,
  };

  if (documentsQuery.isPending) {
    return (
      <>
        <style>{markdownStyles}</style>
        <PreviewShell>Loading preview...</PreviewShell>
      </>
    );
  }
  if (documentsQuery.error) {
    return (
      <>
        <style>{markdownStyles}</style>
        <PreviewShell>{String(documentsQuery.error)}</PreviewShell>
      </>
    );
  }
  const selectedDocumentExists = selectedDocumentId !== undefined &&
    documents?.some((document) => document.id === selectedDocumentId);
  if (!isDocumentList && (!rawDocumentId || !selectedDocumentExists)) {
    globalThis.document.title = "Not Found — Sadoku";
    return (
      <>
        <style>{markdownStyles}</style>
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
      <PreviewLayout
        dialogs={dialogProps}
        header={{
          ...headerActions,
          onChangeView: () => {},
          reloadAvailable: false,
          reloading: false,
          staleCommentCount: 0,
          title: "Documents",
          unresolvedCommentCount: 0,
          view: "preview",
          viewsDisabled: true,
        }}
      >
        <DocumentListPage
          directoryStatus={directoryStatus}
          documents={documents!}
          onSelectDocument={selectDocument}
        />
      </PreviewLayout>
    );
  }

  if (!documentQuery.data || !commentsQuery.data) {
    const error = documentQuery.error ?? commentsQuery.error;
    const selectedDocument = documents?.find((item) =>
      item.id === selectedDocumentId
    );
    return (
      <PreviewLayout
        dialogs={dialogProps}
        header={{
          ...headerActions,
          onChangeView: changeView,
          reloadAvailable: false,
          reloading: false,
          staleCommentCount: 0,
          title: selectedDocument?.relativePath ?? "Preview",
          unresolvedCommentCount: 0,
          view: "preview",
          viewsDisabled: true,
        }}
      >
        <DocumentLoadingPage
          documents={documents}
          error={error}
          onSelectDocument={selectDocument}
          onSelectDocuments={selectDocuments}
          selectedDocument={selectedDocument}
        />
      </PreviewLayout>
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
    <PreviewLayout
      dialogs={{
        ...dialogProps,
        documentId: selectedDocumentId,
        documentTags: document.tags,
      }}
      header={{
        ...headerActions,
        fileUrl: document.fileUrl,
        onChangeView: changeView,
        reloadAvailable,
        reloading: documentQuery.isFetching || commentsQuery.isFetching,
        staleCommentCount,
        title: document.title,
        unresolvedCommentCount,
        view,
      }}
    >
      <DocumentPreviewPage
        document={document}
        documentId={selectedDocumentId}
        documents={documents}
        instructionCount={instructionsQuery.data?.length ?? 0}
        onOpenInstructions={instructionsDisclosure.onOpen}
        onOpenTags={documentTagsDisclosure.onOpen}
        onSelectDocument={selectDocument}
        onSelectDocuments={selectDocuments}
        selectedDocument={selectedDocument}
        settings={settings}
        view={view}
      />
    </PreviewLayout>
  );
};
