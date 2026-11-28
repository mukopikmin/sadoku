import {
  Button,
  Field,
  Flex,
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
  const canReset =
    documentSearch !== "" || tagSearch !== "" || selectedTags.length > 0;
  let emptyMessage = "No Markdown documents found.";
  if (documents.length > 0) {
    emptyMessage = searchQuery
      ? "No documents match the current filters."
      : "No documents match the selected tags.";
  }

  return (
    <VStack align="stretch" gap="3">
      {documents.length > 0 && (
        <VStack
          as="form"
          align="stretch"
          aria-label="Document filters"
          gap="3"
          onReset={(event) => {
            event.preventDefault();
            tree.clear();
            searchInput.current?.focus();
          }}
          onSubmit={(event) => event.preventDefault()}
        >
          <Flex
            align="start"
            gap="3"
            wrap="wrap"
            css={{ "& > *": { flexBasis: "3xs", flexGrow: 1, minW: "0" } }}
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
          </Flex>
          <HStack gap="2" wrap="wrap" srOnly={!canReset}>
            <Text
              role="status"
              color="fg.muted"
              fontSize="sm"
              srOnly={!hasFilters}
            >
              {hasFilters &&
                `Showing ${filteredDocuments.length} of ${documents.length} documents`}
            </Text>
            {canReset && (
              <Button type="reset" size="sm" variant="outline">
                Reset filters
              </Button>
            )}
          </HStack>
        </VStack>
      )}
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
