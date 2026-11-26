import {
  Button,
  Field,
  Grid,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Plus } from "lucide-react";
import { useRef } from "react";
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
  const searchInput = useRef<HTMLInputElement>(null);
  const {
    documentSearch,
    tags,
    selectedTags,
    matchingTags,
    filteredDocuments,
    rootNode,
    searchQuery,
    tagSearch,
  } = tree.state;
  const hasFilters = searchQuery !== "" || selectedTags.length > 0;
  let emptyMessage = "No Markdown documents found.";
  if (documents.length > 0) {
    emptyMessage = searchQuery
      ? "No documents match the current filters."
      : "No documents match the selected tags.";
  }

  return (
    <VStack align="stretch" gap="3">
      {documents.length > 0 && (
        <Grid
          alignItems="start"
          gap="3"
          maxW="calc(2 * {sizes.xs} + {spacing.3})"
          templateColumns="repeat(auto-fit, minmax(min(100%, {sizes.2xs}), 1fr))"
        >
          <Field.Root maxW="xs">
            <Field.Label>Search documents</Field.Label>
            <Input
              ref={searchInput}
              type="search"
              placeholder="Relative path or title"
              value={documentSearch}
              onChange={(event) =>
                tree.setDocumentSearch(event.currentTarget.value)
              }
            />
          </Field.Root>
          {tags.length > 0 && (
            <DocumentTagFilter
              onSearchChange={tree.setTagSearch}
              onSelectTag={tree.selectTag}
              onRemoveTag={tree.removeTag}
              searchValue={tagSearch}
              selectedTags={selectedTags}
              matchingTags={matchingTags}
            />
          )}
        </Grid>
      )}
      <HStack gap="2" wrap="wrap" srOnly={!hasFilters}>
        <Text role="status" color="fg.muted" fontSize="sm">
          {hasFilters &&
            `Showing ${filteredDocuments.length} of ${documents.length} documents`}
        </Text>
        {hasFilters && (
          <Button
            onClick={() => {
              tree.clear();
              searchInput.current?.focus();
            }}
            size="sm"
            variant="outline"
          >
            Clear filters
          </Button>
        )}
      </HStack>
      <VStack
        align="stretch"
        borderColor="border.muted"
        borderRadius="lg"
        borderWidth="1px"
        gap="2"
        p="2"
      >
        {onCreateDocument && (
          <Button
            alignSelf="flex-start"
            size="sm"
            variant="ghost"
            color="fg.muted"
            onClick={() => onCreateDocument("")}
          >
            <Plus aria-hidden="true" /> New file
          </Button>
        )}
        {tree.state.status === "empty" && (
          <VStack gap="2" p="6">
            <Text color="fg.muted">{emptyMessage}</Text>
          </VStack>
        )}
        <DocumentTreeView
          onCreateDocument={onCreateDocument}
          onSelectDocument={onSelectDocument}
          rootNode={rootNode}
          searchQuery={searchQuery}
        />
      </VStack>
    </VStack>
  );
};
