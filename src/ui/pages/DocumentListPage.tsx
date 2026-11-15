import { Alert, Container, Heading, HStack, Link } from "@chakra-ui/react";
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
  onCreateDocument?: (directory: string) => void;
};
export const DocumentListPage = ({
  directoryStatus,
  documents,
  onSelectDocument,
  pullRequest,
  onCreateDocument,
}: Props) => (
  <Container as="main" maxW="980px" px="8" pb="16">
    {pullRequest && (
      <>
        <Heading as="h1" fontSize="3xl" fontWeight="semibold" lineHeight="1.25">
          {pullRequest.title}{" "}
          <Link
            color="fg.muted"
            href={pullRequest.url}
            rel="noopener noreferrer"
            target="_blank"
            textDecoration="none"
            _hover={{ textDecoration: "underline" }}
          >
            #{pullRequest.number}
          </Link>
        </Heading>
        {pullRequest.description && (
          <PullRequestDescription>
            {pullRequest.description}
          </PullRequestDescription>
        )}
      </>
    )}
    <HStack mb="4" justify="space-between">
      <Heading size="md">Documents</Heading>
    </HStack>
    {directoryStatus?.state === "loading" ? (
      <Alert.Root status="info">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Detecting documents</Alert.Title>
          <Alert.Description>
            Detected {directoryStatus.detected} · Registered{" "}
            {directoryStatus.registered}
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    ) : directoryStatus?.state === "error" ? (
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Could not load documents</Alert.Title>
          <Alert.Description>
            {directoryStatus.error?.message}
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    ) : (
      <DocumentTree
        documents={documents}
        onSelectDocument={onSelectDocument}
        onCreateDocument={onCreateDocument}
      />
    )}
  </Container>
);
