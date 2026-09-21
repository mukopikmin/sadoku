import { Alert, Container, Heading, Text } from "@chakra-ui/react";
import type { DirectoryStatus } from "../api/directoryStatus";
import { DocumentTree } from "../components/DocumentTree";
import type { DocumentSummary } from "../models/document";
import type { PullRequestMetadata } from "../models/session";
import { PullRequestDescription } from "../components/PullRequestDescription";

type Props = {
  directoryStatus?: DirectoryStatus | null;
  documents: DocumentSummary[];
  onSelectDocument: (id: number) => void;
  pullRequest?: PullRequestMetadata;
};
export const DocumentListPage = (
  { directoryStatus, documents, onSelectDocument, pullRequest }: Props,
) => (
  <Container as="main" maxW="980px" px="8" pb="16">
    {pullRequest && (
      <>
        <Heading size="lg">{pullRequest.title}</Heading>
        {pullRequest.description && (
          <PullRequestDescription>
            {pullRequest.description}
          </PullRequestDescription>
        )}
      </>
    )}
    <Heading mb="4" size="md">Documents</Heading>
    {directoryStatus?.state === "loading"
      ? (
        <Alert.Root status="info">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>ドキュメントを検出しています</Alert.Title>
            <Alert.Description>
              検出 {directoryStatus.detected} 件・登録{" "}
              {directoryStatus.registered} 件
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )
      : directoryStatus?.state === "error"
      ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>ドキュメントを読み込めませんでした</Alert.Title>
            <Alert.Description>
              {directoryStatus.error?.message}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )
      : documents.length === 0
      ? <Text color="fg.muted">No Markdown documents found.</Text>
      : (
        <DocumentTree
          documents={documents}
          onSelectDocument={onSelectDocument}
        />
      )}
  </Container>
);
