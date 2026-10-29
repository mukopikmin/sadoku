import { DocumentTitle } from "../components/DocumentTitle";
import { Alert, Box, Container, Flex, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useDocumentDiff } from "../hooks/useDocumentDiff";
import { CommentListPage } from "./comments/CommentList";
import { MarkdownPreviewPage } from "./markdown/MarkdownPreviewPage";
import { TableOfContents } from "./markdown/TableOfContents";
import { DocumentActionBar } from "../components/DocumentActionBar";
import { DocumentRevisionsDialog } from "../components/DocumentRevisionsDialog";
import { DocumentBreadcrumb } from "../components/DocumentBreadcrumb";
import type { DocumentSummary, PreviewDocument } from "../models/document";
import type { ResolvedPreviewSettings } from "../models/theme";
import type { PreviewView } from "../models/previewView";

type Props = {
  document: PreviewDocument;
  documentId: number;
  documents?: DocumentSummary[] | null;
  instructionCount: number;
  memoryCount: number;
  onChangeView: (view: PreviewView) => void;
  onOpenInstructions: () => void;
  onOpenMemories: () => void;
  onOpenTags: () => void;
  onSelectDocument: (id: number) => void;
  onSelectDocuments: () => void;
  selectedDocument?: DocumentSummary;
  settings: ResolvedPreviewSettings;
  staleCommentCount: number;
  unresolvedCommentCount: number;
  view: PreviewView;
};
export const DocumentPreviewPage = (
  {
    document,
    documentId,
    documents,
    instructionCount,
    memoryCount,
    onChangeView,
    onOpenInstructions,
    onOpenMemories,
    onOpenTags,
    onSelectDocument,
    onSelectDocuments,
    selectedDocument,
    settings,
    staleCommentCount,
    unresolvedCommentCount,
    view,
  }: Props,
) => {
  const { showHtmlComments } = settings;
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const diff = useDocumentDiff(
    documentId,
    document.markdown,
    document.previousMarkdown,
  );
  const documentPath = selectedDocument?.relativePath ?? document.fileUrl ??
    document.title;
  return (
    <Container as="main" maxW="980px" px="8" pt="0" pb="16">
      {documents && selectedDocument && (
        <DocumentBreadcrumb
          document={selectedDocument}
          documents={documents}
          onSelectDocument={onSelectDocument}
          onSelectDocuments={onSelectDocuments}
        />
      )}
      {view === "preview" && (
        <Flex as="section" aria-label="Document header" align="start" gap="3">
          <Box flex="1" minW="0">
            <DocumentTitle
              key={documentId}
              documentId={documentId}
              title={document.displayTitle}
            />
          </Box>
          <TableOfContents markdown={document.markdown} />
        </Flex>
      )}
      <DocumentActionBar
        diff={diff}
        instructionCount={instructionCount}
        memoryCount={memoryCount}
        onChangeView={onChangeView}
        onOpenInstructions={onOpenInstructions}
        onOpenMemories={onOpenMemories}
        onOpenRevisions={() => setRevisionsOpen(true)}
        tagCount={document.tags.length}
        onOpenTags={onOpenTags}
        tags={document.tags}
        staleCommentCount={staleCommentCount}
        unresolvedCommentCount={unresolvedCommentCount}
        view={view}
      />
      <DocumentRevisionsDialog
        canRestore={document.canRestore}
        deleted={document.deleted}
        documentId={documentId}
        documentPath={documentPath}
        key={`revisions-${documentId}`}
        markdown={document.markdown}
        onOpenChange={setRevisionsOpen}
        open={revisionsOpen}
        showHtmlComments={showHtmlComments}
        theme={settings.theme === "dark" ? "dark" : "default"}
      />
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
      {view === "preview" && diff.changes && (
        <Text
          role="status"
          aria-label={`Changes since previous snapshot: ${diff.changes.current.size} added lines, ${diff.changes.previous.size} removed lines`}
          fontSize="sm"
          color="fg.muted"
          mb="4"
        >
          Changes since previous snapshot: +{diff.changes.current.size} / −
          {diff.changes.previous.size} lines
        </Text>
      )}
      {view === "preview"
        ? (
          <MarkdownPreviewPage
            documentId={documentId}
            documentPath={documentPath}
            key={`${documentId}-${settings.theme}-${settings.fontScale}`}
            markdown={document.markdown}
            previousMarkdown={diff.enabled ? document.previousMarkdown : undefined}
            showHtmlComments={showHtmlComments}
            theme={settings.theme === "dark" ? "dark" : "default"}
          />
        )
        : (
          <CommentListPage
            documentId={documentId}
            documentDeleted={document.deleted}
          />
        )}
    </Container>
  );
};
