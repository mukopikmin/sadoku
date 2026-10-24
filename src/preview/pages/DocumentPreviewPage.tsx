import { DocumentTitle } from "../components/DocumentTitle";
import { Alert, Container } from "@chakra-ui/react";
import { useState } from "react";
import { CommentListPage } from "./comments/CommentList";
import { MarkdownPreviewPage } from "./markdown/MarkdownPreviewPage";
import { DocumentActionBar } from "../components/DocumentActionBar";
import { DocumentRevisionsDialog } from "../components/DocumentRevisionsDialog";
import { DocumentBreadcrumb } from "../components/DocumentBreadcrumb";
import type { DocumentSummary, PreviewDocument } from "../models/document";
import type { ResolvedPreviewSettings } from "../models/theme";
import type { PreviewView } from "../components/layout/PreviewHeader";

type Props = {
  document: PreviewDocument;
  documentId: number;
  documents?: DocumentSummary[] | null;
  instructionCount: number;
  memoryCount: number;
  onOpenInstructions: () => void;
  onOpenMemories: () => void;
  onOpenTags: () => void;
  onSelectDocument: (id: number) => void;
  onSelectDocuments: () => void;
  selectedDocument?: DocumentSummary;
  settings: ResolvedPreviewSettings;
  view: PreviewView;
};
export const DocumentPreviewPage = (
  {
    document,
    documentId,
    documents,
    instructionCount,
    memoryCount,
    onOpenInstructions,
    onOpenMemories,
    onOpenTags,
    onSelectDocument,
    onSelectDocuments,
    selectedDocument,
    settings,
    view,
  }: Props,
) => {
  const [showHtmlComments, setShowHtmlComments] = useState(true);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
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
        <DocumentTitle
          key={documentId}
          documentId={documentId}
          title={document.displayTitle}
        />
      )}
      {view === "preview" && (
        <DocumentActionBar
          instructionCount={instructionCount}
          memoryCount={memoryCount}
          markdown={document.markdown}
          onOpenInstructions={onOpenInstructions}
          onOpenMemories={onOpenMemories}
          onOpenRevisions={() => setRevisionsOpen(true)}
          onToggleHtmlComments={() => setShowHtmlComments((shown) => !shown)}
          showHtmlComments={showHtmlComments}
          tagCount={document.tags.length}
          onOpenTags={onOpenTags}
          tags={document.tags}
        />
      )}
      <DocumentRevisionsDialog
        documentId={documentId}
        documentPath={documentPath}
        key={`revisions-${documentId}`}
        markdown={document.markdown}
        onOpenChange={setRevisionsOpen}
        open={view === "preview" && revisionsOpen}
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
    </Container>
  );
};
