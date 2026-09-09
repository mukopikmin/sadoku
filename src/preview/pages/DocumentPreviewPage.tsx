import { Alert, Container } from "@chakra-ui/react";
import { useState } from "react";
import { CommentListPage } from "./comments/CommentList";
import { MarkdownPreviewPage } from "./markdown/MarkdownPreviewPage";
import { DocumentActionBar } from "../components/DocumentActionBar";
import { DocumentBreadcrumb } from "../components/DocumentBreadcrumb";
import type { DocumentSummary, PreviewDocument } from "../models/document";
import type { ResolvedPreviewSettings } from "../models/theme";
import type { PreviewView } from "../components/layout/PreviewHeader";

type Props = {
  document: PreviewDocument;
  documentId: number;
  documents?: DocumentSummary[] | null;
  instructionCount: number;
  onOpenInstructions: () => void;
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
    onOpenInstructions,
    onOpenTags,
    onSelectDocument,
    onSelectDocuments,
    selectedDocument,
    settings,
    view,
  }: Props,
) => {
  const [showHtmlComments, setShowHtmlComments] = useState(true);
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
        <DocumentActionBar
          instructionCount={instructionCount}
          markdown={document.markdown}
          onOpenInstructions={onOpenInstructions}
          onToggleHtmlComments={() => setShowHtmlComments((shown) => !shown)}
          showHtmlComments={showHtmlComments}
          tagCount={document.tags.length}
          onOpenTags={onOpenTags}
          tags={document.tags}
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
            documentId={documentId}
            documentPath={selectedDocument?.relativePath ?? document.fileUrl ??
              document.title}
            key={`${documentId}-${settings.theme}-${settings.fontScale}`}
            markdown={document.markdown}
            showHtmlComments={showHtmlComments}
            theme={settings.theme === "dark" ? "dark" : "default"}
          />
        )
        : <CommentListPage documentId={documentId} />}
    </Container>
  );
};
