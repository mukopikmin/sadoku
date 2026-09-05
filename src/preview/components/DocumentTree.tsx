import {
  Badge,
  Button,
  Combobox,
  createListCollection,
  createTreeCollection,
  HStack,
  Portal,
  Text,
  TreeView,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { ChevronRight, File, Folder } from "lucide-react";
import { useMemo, useState } from "react";
import type { DocumentSummary } from "../models/document";
import { TagLabel } from "./ui/TagLabel";

type DocumentTreeNode = {
  children?: DocumentTreeNode[];
  documentId?: number;
  deleted?: boolean;
  name: string;
  tags?: DocumentSummary["tags"];
  value: string;
};

const createDocumentTree = (documents: DocumentSummary[]) => {
  const root: DocumentTreeNode = {
    children: [],
    name: "Documents",
    value: "root",
  };

  for (const document of documents) {
    const parts = document.relativePath.split("/").filter(Boolean);
    let parent = root;

    parts.forEach((part, index) => {
      const isDocument = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join("/");
      if (isDocument) {
        parent.children!.push({
          documentId: document.id,
          deleted: document.deleted,
          name: part,
          tags: document.tags,
          value: `document:${document.id}`,
        });
        return;
      }

      let directory = parent.children!.find((node) =>
        node.value === `directory:${path}`
      );
      if (!directory) {
        directory = {
          children: [],
          name: part,
          value: `directory:${path}`,
        };
        parent.children!.push(directory);
      }
      parent = directory;
    });
  }

  const sortChildren = (node: DocumentTreeNode) => {
    node.children?.sort((left, right) => {
      const leftIsDirectory = left.children !== undefined;
      const rightIsDirectory = right.children !== undefined;
      if (leftIsDirectory !== rightIsDirectory) {
        return leftIsDirectory ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
    node.children?.forEach(sortChildren);
  };
  sortChildren(root);

  return root;
};

const getDirectoryValues = (node: DocumentTreeNode): string[] =>
  (node.children ?? []).flatMap((child) =>
    child.children ? [child.value, ...getDirectoryValues(child)] : []
  );

type DocumentTreeProps = {
  documents: DocumentSummary[];
  onSelectDocument: (id: number) => void;
};

export const DocumentTree = (
  { documents, onSelectDocument }: DocumentTreeProps,
) => {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const tags = useMemo(() => {
    const tagsById = new Map(
      documents.flatMap((document) => document.tags).map((
        tag,
      ) => [tag.id, tag]),
    );
    return [...tagsById.values()].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [documents]);
  const availableTagIds = useMemo(() => new Set(tags.map(({ id }) => id)), [
    tags,
  ]);
  const activeTagIds = useMemo(
    () => selectedTagIds.filter((id) => availableTagIds.has(id)),
    [availableTagIds, selectedTagIds],
  );
  const selectedTags = tags.filter((tag) => activeTagIds.includes(tag.id));
  const matchingTags = useMemo(() => {
    const search = tagSearch.trim().toLocaleLowerCase();
    if (search.length === 0) return tags;
    return tags.filter((tag) => tag.name.toLocaleLowerCase().includes(search));
  }, [tagSearch, tags]);
  const tagCollection = useMemo(
    () =>
      createListCollection({
        items: matchingTags,
        itemToString: (tag) => tag.name,
        itemToValue: (tag) => String(tag.id),
      }),
    [matchingTags],
  );
  const filteredDocuments = useMemo(
    () =>
      activeTagIds.length === 0
        ? documents
        : documents.filter((document) =>
          document.tags.some((tag) => activeTagIds.includes(tag.id))
        ),
    [activeTagIds, documents],
  );
  const rootNode = useMemo(
    () => createDocumentTree(filteredDocuments),
    [filteredDocuments],
  );
  const collection = useMemo(
    () =>
      createTreeCollection<DocumentTreeNode>({
        nodeToString: (node) => node.name,
        nodeToValue: (node) => node.value,
        rootNode,
      }),
    [rootNode],
  );
  const [expandedValue, setExpandedValue] = useState<string[]>(() =>
    getDirectoryValues(rootNode)
  );

  return (
    <VStack align="stretch" gap="3">
      {tags.length > 0 && (
        <VStack align="stretch" gap="2">
          <Combobox.Root
            closeOnSelect
            collection={tagCollection}
            inputValue={tagSearch}
            multiple
            onInputValueChange={({ inputValue }) => setTagSearch(inputValue)}
            onValueChange={({ value }) =>
              setSelectedTagIds(value.map(Number).filter(Number.isSafeInteger))}
            positioning={{ sameWidth: true }}
            value={activeTagIds.map(String)}
            width="320px"
            maxW="full"
          >
            <Combobox.Label>Filter by tag</Combobox.Label>
            <Wrap gap="2">
              {selectedTags.map((tag) => (
                <TagLabel
                  backgroundColor={tag.backgroundColor}
                  key={tag.id}
                  name={tag.name}
                />
              ))}
            </Wrap>
            <Combobox.Control>
              <Combobox.Input
                aria-label="Search tags"
                placeholder="Search tags to add"
              />
              <Combobox.IndicatorGroup>
                <Combobox.Trigger aria-label="Show tag options" />
              </Combobox.IndicatorGroup>
            </Combobox.Control>
            <Portal>
              <Combobox.Positioner>
                <Combobox.Content maxH="48" overflowY="auto">
                  <Combobox.ItemGroup>
                    <Combobox.ItemGroupLabel>Tags</Combobox.ItemGroupLabel>
                    {matchingTags.map((tag) => (
                      <Combobox.Item item={tag} key={tag.id}>
                        <TagLabel
                          backgroundColor={tag.backgroundColor}
                          name={tag.name}
                        />
                        <Combobox.ItemIndicator />
                      </Combobox.Item>
                    ))}
                    <Combobox.Empty>No matching tags.</Combobox.Empty>
                  </Combobox.ItemGroup>
                </Combobox.Content>
              </Combobox.Positioner>
            </Portal>
          </Combobox.Root>
          {activeTagIds.length > 0 && (
            <Text color="fg.muted" fontSize="sm">
              Showing {filteredDocuments.length} of {documents.length} documents
            </Text>
          )}
        </VStack>
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
          <TreeView.Root
            collection={collection}
            expandOnClick={false}
            expandedValue={expandedValue}
            onExpandedChange={({ expandedValue }) =>
              setExpandedValue(expandedValue)}
            onSelectionChange={({ selectedNodes }) => {
              const selectedDocument = selectedNodes.find((node) =>
                node.documentId !== undefined
              );
              if (selectedDocument?.documentId !== undefined) {
                onSelectDocument(selectedDocument.documentId);
              }
            }}
            borderColor="border.muted"
            borderRadius="lg"
            borderWidth="1px"
            p="2"
          >
            <TreeView.Tree aria-label="Documents">
              <TreeView.Node<DocumentTreeNode>
                indentGuide={
                  <TreeView.BranchIndentGuide borderColor="border.muted" />
                }
                render={({ node, nodeState }) =>
                  nodeState.isBranch
                    ? (
                      <TreeView.BranchControl
                        borderRadius="md"
                        py="1.5"
                        _hover={{ bg: "bg.muted" }}
                      >
                        <TreeView.BranchTrigger
                          aria-label={`${node.name} folder`}
                        >
                          <TreeView.BranchIndicator>
                            <ChevronRight aria-hidden="true" />
                          </TreeView.BranchIndicator>
                        </TreeView.BranchTrigger>
                        <Folder aria-hidden="true" />
                        <TreeView.BranchText fontWeight="medium">
                          {node.name}
                        </TreeView.BranchText>
                      </TreeView.BranchControl>
                    )
                    : (
                      <TreeView.Item
                        borderRadius="md"
                        cursor="pointer"
                        py="1.5"
                        _hover={{ bg: "bg.muted" }}
                      >
                        <TreeView.ItemIndicator
                          aria-hidden="true"
                          flexShrink="0"
                          width="var(--tree-icon-size)"
                        />
                        <File aria-hidden="true" />
                        <TreeView.ItemText flex="0 1 auto">
                          {node.name}
                        </TreeView.ItemText>
                        {node.tags && node.tags.length > 0 && (
                          <HStack gap="1" flexShrink="0" width="fit-content">
                            {node.tags.map((tag) => (
                              <TagLabel
                                key={tag.id}
                                backgroundColor={tag.backgroundColor}
                                name={tag.name}
                              />
                            ))}
                          </HStack>
                        )}
                        {node.deleted && (
                          <Badge ms="auto" colorPalette="red">Deleted</Badge>
                        )}
                      </TreeView.Item>
                    )}
              />
            </TreeView.Tree>
          </TreeView.Root>
        )}
    </VStack>
  );
};
