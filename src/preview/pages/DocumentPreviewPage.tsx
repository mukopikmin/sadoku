import { DocumentTitle } from "../components/DocumentTitle";
import { Alert, Box, Container, Flex, Text } from "@chakra-ui/react";
import { type RefObject, useState } from "react";
import { useDocumentDiff } from "../hooks/useDocumentDiff";
import { CommentListPage } from "./comments/CommentList";
import { MarkdownPreviewPage } from "./markdown/MarkdownPreviewPage";
import { DocumentNavigation } from "../components/DocumentNavigation";
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
  documentNavigationInHeader: boolean;
  documents?: DocumentSummary[] | null;
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
export const DocumentPreviewPage = ({
  document,
  documentId,
  documentHeaderRef,
  documentNavigationInHeader,
  documents,
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
}: Props) => {
  const { showHtmlComments } = settings;
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const diff = useDocumentDiff(
    documentId,
    document.markdown,
    document.previousMarkdown,
  );
  const documentPath =
    selectedDocument?.relativePath ?? document.fileUrl ?? document.title;
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
            trailingAction={
              // Preserve the measured title area when controls move to the header.
              <Box
                maxW="full"
                visibility={documentNavigationInHeader ? "hidden" : "visible"}
              >
                <DocumentNavigation
                  markdown={document.markdown}
                  onChangeView={onChangeView}
                  showLabels
                  staleCommentCount={staleCommentCount}
                  unresolvedCommentCount={unresolvedCommentCount}
                  view={view}
                />
              </Box>
            }
          />
        </Box>
      </Flex>
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
      {view === "preview" ? (
        <MarkdownPreviewPage
          documentId={documentId}
          documentPath={documentPath}
          key={`${documentId}-${settings.theme}-${settings.fontScale}`}
          markdown={document.markdown}
          previousMarkdown={
            diff.enabled ? document.previousMarkdown : undefined
          }
          showHtmlComments={showHtmlComments}
          theme={settings.theme === "dark" ? "dark" : "default"}
        />
      ) : (
        <CommentListPage
          documentId={documentId}
          documentDeleted={document.deleted}
        />
      )}
      {view === "preview" && (
        <DocumentActionBar
          diff={diff}
          memoryCount={memoryCount}
          onOpenInstructions={onOpenInstructions}
          onOpenMemories={onOpenMemories}
          onOpenRevisions={() => setRevisionsOpen(true)}
          tagCount={document.tags.length}
          onOpenTags={onOpenTags}
          tags={document.tags}
        />
      )}
    </Container>
  );
};
