import { useDisclosure } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { PreviewView } from "../models/previewView";
import { useHotReload } from "./useHotReload";
import { useConnection } from "./useConnection";
import { reportConnection } from "../api/connection";
import { isSyncEnabled, connectPreviewKeepAlive } from "../api/hotReload";
import { useCommentsQuery } from "./useComments";
import {
  useDirectoryStatusQuery,
  useDocumentsQuery,
  usePreviewDocumentQuery,
} from "./useDocuments";
import { useMemoriesQuery } from "./useMemories";
import { usePreviewSettings } from "./usePreviewSettings";
import { useScrollPosition } from "./useScrollPosition";
import { useCollapsedDocumentHeader } from "./useCollapsedDocumentHeader";
import { usePreviewRoute } from "./usePreviewRoute";
import { isUnresolvedComment } from "../models/comment";
import { useSessionQuery } from "./useSession";
import { useDocumentCreator } from "./useDocumentCreator";

export const usePreviewApp = () => {
  const tagsTriggerRef = useRef<HTMLButtonElement>(null);
  const globalInstructionsTriggerRef = useRef<HTMLButtonElement>(null);
  const {
    documentId: selectedDocumentId,
    isDocumentList,
    hash,
    pathname,
    rawDocumentId,
    view,
  } = usePreviewRoute();
  const navigate = useNavigate();
  const documentCreator = useDocumentCreator((id) => {
    void navigate({
      to: "/documents/$documentId",
      params: { documentId: String(id) },
    });
  });
  const documentsQuery = useDocumentsQuery();
  const sessionQuery = useSessionQuery();
  const directoryStatusQuery = useDirectoryStatusQuery();
  const directoryStatus = directoryStatusQuery.data;
  const documents = documentsQuery.data;
  const directoryMode = documents !== null && documents !== undefined;
  const shouldLoadDocument =
    documentsQuery.isSuccess &&
    (!directoryMode || selectedDocumentId !== undefined);
  const documentQuery = usePreviewDocumentQuery(
    selectedDocumentId,
    shouldLoadDocument,
  );
  const commentsQuery = useCommentsQuery(
    selectedDocumentId,
    shouldLoadDocument,
  );
  const memoriesQuery = useMemoriesQuery(
    selectedDocumentId,
    shouldLoadDocument,
  );
  const targetComment = commentsQuery.data?.comments.find(
    (comment) =>
      hash === `comment-${comment.id}` &&
      comment.state !== "stale" &&
      comment.currentSource?.state === "available",
  );
  const saveScrollPosition = useScrollPosition(
    selectedDocumentId,
    view,
    Boolean(documentQuery.data && commentsQuery.data),
    view === "preview" ? targetComment?.startLine : undefined,
  );
  const { collapsed, documentHeaderRef, headerRef } =
    useCollapsedDocumentHeader(
      selectedDocumentId,
      Boolean(documentQuery.data && commentsQuery.data),
      view,
    );
  const settingsDisclosure = useDisclosure();
  const instructionsDisclosure = useDisclosure();
  const globalInstructionsDisclosure = useDisclosure();
  const memoriesDisclosure = useDisclosure();
  const tagsDisclosure = useDisclosure();
  const documentTagsDisclosure = useDisclosure();
  const connectionLost = useConnection();
  const {
    changeCodeWrapMode,
    changeDirectoryLimits,
    changeExcludedDirectories,
    changeFontScale,
    changeMarkdownExtensions,
    changeShowHighlightBoundaries,
    changeShowHtmlComments,
    changeThemeMode,
    state: settingsState,
  } = usePreviewSettings();
  const settings = settingsState.settings;
  const { clearReloadAvailable, reloadAvailable } =
    useHotReload(selectedDocumentId);
  const settingsActions = {
    onCodeWrapModeChange: changeCodeWrapMode,
    onDirectoryLimitsChange: changeDirectoryLimits,
    onExcludedDirectoriesChange: changeExcludedDirectories,
    onFontScaleChange: changeFontScale,
    onMarkdownExtensionsChange: changeMarkdownExtensions,
    onShowHighlightBoundariesChange: changeShowHighlightBoundaries,
    onShowHtmlCommentsChange: changeShowHtmlComments,
    onThemeModeChange: changeThemeMode,
  };

  useEffect(
    () =>
      connectPreviewKeepAlive({
        onConnectionLost: () => reportConnection(true),
        onConnectionRestored: () => reportConnection(false),
      }),
    [],
  );

  const changeView = (nextView: PreviewView) => {
    if (nextView === view || selectedDocumentId === undefined) return;
    saveScrollPosition();
    void navigate({
      to:
        nextView === "comments"
          ? "/documents/$documentId/comments"
          : "/documents/$documentId",
      params: { documentId: String(selectedDocumentId) },
    });
  };

  const openComment = (commentId: number) => {
    if (selectedDocumentId === undefined) return;
    saveScrollPosition();
    void navigate({
      to: "/documents/$documentId",
      params: { documentId: String(selectedDocumentId) },
      hash: `comment-${commentId}`,
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
    if (!isSyncEnabled()) {
      await Promise.all([
        documentsQuery.refetch(),
        directoryStatusQuery.refetch(),
        sessionQuery.refetch(),
      ]);
      if (selectedDocumentId === undefined) return;
    }
    const [documentResult, commentsResult] = await Promise.all([
      documentQuery.refetch(),
      commentsQuery.refetch(),
    ]);
    if (documentResult.isSuccess && commentsResult.isSuccess) {
      clearReloadAvailable();
    }
  };

  useEffect(() => {
    if (
      !isDocumentList &&
      documentsQuery.isSuccess &&
      (!rawDocumentId ||
        !documents?.some((item) => item.id === selectedDocumentId))
    ) {
      globalThis.document.title = "Not Found — Sadoku";
    } else if (pathname === "/") {
      globalThis.document.title = "Documents — Sadoku";
    } else if (documentQuery.data) {
      globalThis.document.title =
        view === "comments"
          ? `Comments — ${documentQuery.data.title} — Sadoku`
          : `${documentQuery.data.title} — Sadoku`;
    }
  }, [
    documentQuery.data,
    pathname,
    view,
    isDocumentList,
    documentsQuery.isSuccess,
    rawDocumentId,
    documents,
    selectedDocumentId,
  ]);

  const refetchDocuments = documentsQuery.refetch;
  useEffect(() => {
    if (directoryStatus?.state === "ready") void refetchDocuments();
  }, [directoryStatus?.state, refetchDocuments]);

  const dialogProps = {
    globalInstructions: globalInstructionsDisclosure,
    globalInstructionsTriggerRef,
    documentInstructions: instructionsDisclosure,
    documentMemories: memoriesDisclosure,
    documentTagsDialog: documentTagsDisclosure,
    settings,
    settingsActions,
    settingsDialog: settingsDisclosure,
    tagsDialog: tagsDisclosure,
    tagsTriggerRef,
  };
  const headerActions = {
    connectionLost,
    onOpenGlobalInstructions: globalInstructionsDisclosure.onOpen,
    globalInstructionsTriggerRef,
    onOpenSettings: settingsDisclosure.onOpen,
    onOpenTags: tagsDisclosure.onOpen,
    onReloadPreview: reloadPreview,
    tagsTriggerRef,
  };

  if (documentsQuery.isPending) return { status: "loading" as const };
  if (documentsQuery.error)
    return { status: "error" as const, message: String(documentsQuery.error) };
  const selectedDocument = documents?.find(
    (item) => item.id === selectedDocumentId,
  );
  if (!isDocumentList && (!rawDocumentId || !selectedDocument))
    return { status: "not-found" as const };
  const listHeader = {
    ...headerActions,
    reloadAvailable: !isSyncEnabled(),
    reloading:
      documentsQuery.isFetching ||
      directoryStatusQuery.isFetching ||
      sessionQuery.isFetching,
    title: selectedDocument?.relativePath ?? "Documents",
  };
  if (selectedDocumentId === undefined)
    return {
      status: "list" as const,
      dialogs: dialogProps,
      header: listHeader,
      creator: documentCreator,
      page: {
        directoryStatus,
        documents: documents!,
        onSelectDocument: selectDocument,
        pullRequest: sessionQuery.data?.pullRequest,
        onCreateDocument:
          sessionQuery.data?.canCreateDocuments &&
          directoryStatus?.state !== "loading" &&
          directoryStatus?.state !== "error"
            ? documentCreator.open
            : undefined,
      },
    };
  if (!documentQuery.data || !commentsQuery.data) {
    const error = documentQuery.error ?? commentsQuery.error;
    const page = {
      documents,
      onSelectDocument: selectDocument,
      onSelectDocuments: selectDocuments,
      selectedDocument,
    };
    return error
      ? {
          status: "document-error" as const,
          dialogs: dialogProps,
          header: listHeader,
          page: { ...page, error },
        }
      : {
          status: "document-loading" as const,
          dialogs: dialogProps,
          header: listHeader,
          page: { ...page, error: null },
        };
  }
  const { comments } = commentsQuery.data;
  const document = documentQuery.data;
  const staleCommentCount = comments.filter(
    (comment) => comment.state === "stale",
  ).length;
  const unresolvedCommentCount = comments.filter(isUnresolvedComment).length;
  return {
    status: "document" as const,
    dialogs: {
      ...dialogProps,
      documentId: selectedDocumentId,
      documentTags: document.tags,
    },
    header: {
      ...headerActions,
      collapsedDocument: collapsed
        ? { title: document.displayTitle }
        : undefined,
      fileUrl: document.fileUrl,
      documentNavigation: collapsed
        ? {
            onChangeView: changeView,
            staleCommentCount,
            unresolvedCommentCount,
            view,
          }
        : undefined,
      headerRef,
      reloadAvailable: reloadAvailable || !isSyncEnabled(),
      reloading: documentQuery.isFetching || commentsQuery.isFetching,
      title: document.title,
    },
    page: {
      document,
      documentId: selectedDocumentId,
      documentHeaderRef,
      documentNavigationInHeader: collapsed,
      documents,
      memoryCount: memoriesQuery.data?.length ?? 0,
      onChangeView: changeView,
      onOpenComment: openComment,
      onOpenInstructions: instructionsDisclosure.onOpen,
      onOpenMemories: memoriesDisclosure.onOpen,
      onOpenTags: documentTagsDisclosure.onOpen,
      onSelectDocument: selectDocument,
      onSelectDocuments: selectDocuments,
      selectedDocument,
      settings,
      staleCommentCount,
      unresolvedCommentCount,
      view,
    },
  };
};
