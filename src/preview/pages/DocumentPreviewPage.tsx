import { DocumentTitle } from "../components/DocumentTitle";
import { Alert, Box, Container, Flex } from "@chakra-ui/react";
import { type RefObject, useState } from "react";
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
  documentHeaderRef?: RefObject<HTMLDivElement | null>;
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
    documentHeaderRef,
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
  const documentPath = selectedDocument?.relativePath ?? document.fileUrl ??
    document.title;
  return (
    <Container as="main" maxW="980px" px="8" pt="0" pb="8">
      {documents && selectedDocument && (
        <DocumentBreadcrumb
          document={selectedDocument}
          documents={documents}
          onSelectDocument={onSelectDocument}
          onSelectDocuments={onSelectDocuments}
        />
      )}
      {view === "preview" && (
        <Flex
          as="section"
          aria-label="Document header"
          ref={documentHeaderRef}
          align="start"
          gap="3"
        >
          <Box flex="1" minW="0">
            <DocumentTitle
              key={documentId}
              documentId={documentId}
              title={document.displayTitle}
              trailingAction={<TableOfContents markdown={document.markdown} />}
            />
          </Box>
        </Flex>
      )}
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
      {view === "preview"
        ? (
          <MarkdownPreviewPage
            documentId={documentId}
            documentPath={documentPath}
            key={`${documentId}-${settings.theme}-${settings.fontScale}`}
            markdown={document.markdown}
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
      <DocumentActionBar
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
    </Container>
  );
};
