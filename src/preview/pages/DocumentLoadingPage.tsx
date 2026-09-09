import { Container, Text } from "@chakra-ui/react";
import { DocumentBreadcrumb } from "../components/DocumentBreadcrumb";
import type { DocumentSummary } from "../models/document";

type Props = {
  documents?: DocumentSummary[] | null;
  error: unknown;
  onSelectDocument: (id: number) => void;
  onSelectDocuments: () => void;
  selectedDocument?: DocumentSummary;
};
export const DocumentLoadingPage = (
  { documents, error, onSelectDocument, onSelectDocuments, selectedDocument }:
    Props,
) => (
  <Container as="main" maxW="980px" px="8" pb="16">
    {documents && selectedDocument && (
      <DocumentBreadcrumb
        document={selectedDocument}
        documents={documents}
        onSelectDocument={onSelectDocument}
        onSelectDocuments={onSelectDocuments}
      />
    )}
    <Text color={error ? "fg.error" : "fg.muted"}>
      {error
        ? error instanceof Error ? error.message : String(error)
        : "Loading preview..."}
    </Text>
  </Container>
);
