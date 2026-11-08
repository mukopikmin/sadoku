import { Text, VStack } from "@chakra-ui/react";
import type { DocumentSummary } from "../models/document";
import { useDocumentTree } from "../hooks/useDocumentTree";
import { DocumentTagFilter } from "./DocumentTagFilter";
import { DocumentTreeView } from "./DocumentTreeView";

type DocumentTreeProps = {
  documents: DocumentSummary[];
  onSelectDocument: (id: number) => void;
  onCreateDocument?: (directory: string) => void;
};

export const DocumentTree = ({
  documents,
  onSelectDocument,
  onCreateDocument,
}: DocumentTreeProps) => {
  const tree = useDocumentTree(documents);
  const { tags, activeTagIds, filteredDocuments, rootNode, tagSearch } =
    tree.state;

  return (
    <VStack align="stretch" gap="3">
      {tags.length > 0 && (
        <DocumentTagFilter
          documentCount={documents.length}
          filteredDocumentCount={filteredDocuments.length}
          onClearFilters={tree.clear}
          onSearchChange={tree.setTagSearch}
          onSelectedTagIdsChange={tree.setSelectedTagIds}
          searchValue={tagSearch}
          selectedTagIds={activeTagIds}
          tags={tags}
        />
      )}
      {tree.state.status === "empty" ? (
        <VStack
          borderColor="border.muted"
          borderRadius="lg"
          borderWidth="1px"
          gap="2"
          p="6"
        >
          <Text color="fg.muted">No documents match the selected tags.</Text>
        </VStack>
      ) : (
        <DocumentTreeView
          onCreateDocument={onCreateDocument}
          onSelectDocument={onSelectDocument}
          rootNode={rootNode}
        />
      )}
    </VStack>
  );
};
