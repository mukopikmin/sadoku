import { Button, Text, VStack } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { DocumentSummary } from "../models/document";
import {
  collectDocumentTags,
  createDocumentTree,
  filterDocumentsByTags,
  reconcileSelectedTagIds,
} from "../models/documentTree";
import { DocumentTagFilter } from "./DocumentTagFilter";
import { DocumentTreeView } from "./DocumentTreeView";

type DocumentTreeProps = {
  documents: DocumentSummary[];
  onSelectDocument: (id: number) => void;
};

export const DocumentTree = (
  { documents, onSelectDocument }: DocumentTreeProps,
) => {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const tags = useMemo(() => collectDocumentTags(documents), [documents]);
  const activeTagIds = useMemo(
    () => reconcileSelectedTagIds(selectedTagIds, tags),
    [selectedTagIds, tags],
  );
  const filteredDocuments = useMemo(
    () => filterDocumentsByTags(documents, activeTagIds),
    [activeTagIds, documents],
  );
  const rootNode = useMemo(
    () => createDocumentTree(filteredDocuments),
    [filteredDocuments],
  );

  return (
    <VStack align="stretch" gap="3">
      {tags.length > 0 && (
        <DocumentTagFilter
          documentCount={documents.length}
          filteredDocumentCount={filteredDocuments.length}
          onSearchChange={setTagSearch}
          onSelectedTagIdsChange={setSelectedTagIds}
          searchValue={tagSearch}
          selectedTagIds={activeTagIds}
          tags={tags}
        />
      )}
      {filteredDocuments.length === 0
        ? (
          <VStack
            borderColor="border.muted"
            borderRadius="lg"
            borderWidth="1px"
            gap="2"
            p="6"
          >
            <Text color="fg.muted">No documents match the selected tags.</Text>
            <Button
              onClick={() => {
                setSelectedTagIds([]);
                setTagSearch("");
              }}
              size="sm"
              variant="outline"
            >
              Clear filters
            </Button>
          </VStack>
        )
        : (
          <DocumentTreeView
            onSelectDocument={onSelectDocument}
            rootNode={rootNode}
          />
        )}
    </VStack>
  );
};
