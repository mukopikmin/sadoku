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
  onSelectDocuments: () => void;
};

const DocumentBreadcrumb = ({
  documentName,
  onSelectDocuments,
}: DocumentBreadcrumbProps) => (
  <Breadcrumb.Root aria-label="Document path" mb="6">
    <Breadcrumb.List>
      <Breadcrumb.Item>
        <Breadcrumb.Link
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onSelectDocuments();
          }}
        >
          Documents
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
  const documentsQuery = useDocumentsQuery();
  const documents = documentsQuery.data;
  const directoryMode = documents !== null && documents !== undefined;
  const [selectedDocumentId, setSelectedDocumentId] = useState<number>();
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
  const [view, setView] = useState<PreviewView>("preview");
  const settingsDisclosure = useDisclosure();
  const { changeCodeWrapMode, changeThemeMode, codeWrapMode, themeMode } =
    usePreviewSettings();
  const { clearReloadAvailable, reloadAvailable } = useHotReload(
    selectedDocumentId,
  );

  useEffect(() => {
    setView("preview");
    clearReloadAvailable();
  }, [selectedDocumentId]);

  const selectDocument = (id: number | undefined) => {
    setSelectedDocumentId(id);
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
  if (directoryMode && selectedDocumentId === undefined) {
    return (
      <>
        <style>{previewThemeCss}</style>
        <PreviewHeader
          onChangeView={setView}
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
                    justifyContent="flex-start"
                    key={document.id}
                    onClick={() => selectDocument(document.id)}
                    variant="ghost"
                  >
                    {document.relativePath}
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
          onChangeView={setView}
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
              onSelectDocuments={() => selectDocument(undefined)}
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
        onChangeView={setView}
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
            onSelectDocuments={() => selectDocument(undefined)}
          />
        )}
        {view === "preview"
          ? (
            <MarkdownPreviewPage
              documentId={selectedDocumentId}
              key={`${selectedDocumentId ?? "legacy"}-${themeMode}`}
              markdown={document.markdown}
              theme={themeMode === "dark" ? "dark" : "default"}
            />
          )
          : <CommentListPage documentId={selectedDocumentId} />}
      </Container>
    </>
  );
};
