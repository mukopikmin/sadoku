import {
  Breadcrumb,
  Button,
  Container,
  Heading,
  Stack,
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
import {
  useCommentsQuery,
  useDocumentsQuery,
  usePreviewDocumentQuery,
} from "./hooks/usePreviewData";
import { usePreviewSettings } from "./hooks/usePreviewSettings";
import { isUnresolvedComment } from "./models/comment";
import { SettingsDialog } from "./components/SettingsDialog";

type DocumentBreadcrumbProps = {
  documentName: string;
};

const DocumentBreadcrumb = ({
  documentName,
}: DocumentBreadcrumbProps) => (
  <Breadcrumb.Root aria-label="Document path" mb="6">
    <Breadcrumb.List>
      <Breadcrumb.Item>
        <Breadcrumb.Link asChild>
          <RouterLink to="/">Documents</RouterLink>
        </Breadcrumb.Link>
      </Breadcrumb.Item>
      <Breadcrumb.Separator />
      <Breadcrumb.Item>
        <Breadcrumb.CurrentLink>{documentName}</Breadcrumb.CurrentLink>
      </Breadcrumb.Item>
    </Breadcrumb.List>
  </Breadcrumb.Root>
);

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
  const { changeCodeWrapMode, changeThemeMode, codeWrapMode, themeMode } =
    usePreviewSettings();
  const { clearReloadAvailable, reloadAvailable } = useHotReload(
    selectedDocumentId,
  );

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
          onCodeWrapModeChange={changeCodeWrapMode}
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
              <Stack align="stretch" gap="2">
                {documents!.map((document) => (
                  <Button
                    asChild
                    justifyContent="flex-start"
                    key={document.id}
                    variant="ghost"
                  >
                    <RouterLink
                      params={{ documentId: String(document.id) }}
                      to="/documents/$documentId"
                    >
                      {document.relativePath}
                    </RouterLink>
                  </Button>
                ))}
              </Stack>
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
          onCodeWrapModeChange={changeCodeWrapMode}
          onOpenChange={settingsDisclosure.setOpen}
          onThemeModeChange={changeThemeMode}
          open={settingsDisclosure.open}
          themeMode={themeMode}
        />
        <Container as="main" maxW="980px" px="8" pb="16">
          {directoryMode && selectedDocument && (
            <DocumentBreadcrumb
              documentName={selectedDocument.relativePath}
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
        onCodeWrapModeChange={changeCodeWrapMode}
        onOpenChange={settingsDisclosure.setOpen}
        onThemeModeChange={changeThemeMode}
        open={settingsDisclosure.open}
        themeMode={themeMode}
      />
      <Container as="main" maxW="980px" px="8" pt="0" pb="16">
        {directoryMode && selectedDocument && (
          <DocumentBreadcrumb
            documentName={selectedDocument.relativePath}
          />
        )}
        {view === "preview"
          ? (
            <MarkdownPreviewPage
              documentId={selectedDocumentId}
              key={`${selectedDocumentId}-${themeMode}`}
              markdown={document.markdown}
              theme={themeMode === "dark" ? "dark" : "default"}
            />
          )
          : <CommentListPage documentId={selectedDocumentId} />}
      </Container>
    </>
  );
};
