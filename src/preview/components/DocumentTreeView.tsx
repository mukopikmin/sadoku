import {
  Badge,
  createTreeCollection,
  HStack,
  IconButton,
  TreeView,
} from "@chakra-ui/react";
import { ChevronRight, File, Folder, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type DocumentTreeNode,
  getDirectoryValues,
} from "../models/documentTree";
import { TagLabel } from "./ui/TagLabel";
import { Tooltip } from "./ui/tooltip";

type DocumentTreeViewProps = {
  onSelectDocument: (id: number) => void;
  rootNode: DocumentTreeNode;
  onCreateDocument?: (directory: string) => void;
};

export const DocumentTreeView = (
  { onSelectDocument, rootNode, onCreateDocument }: DocumentTreeViewProps,
) => {
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
    <TreeView.Root
      collection={collection}
      expandOnClick={false}
      expandedValue={expandedValue}
      onExpandedChange={({ expandedValue }) => setExpandedValue(expandedValue)}
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
                  <TreeView.BranchTrigger aria-label={`${node.name} folder`}>
                    <TreeView.BranchIndicator>
                      <ChevronRight aria-hidden="true" />
                    </TreeView.BranchIndicator>
                  </TreeView.BranchTrigger>
                  <Folder aria-hidden="true" />
                  <TreeView.BranchText fontWeight="medium">
                    {node.name}
                  </TreeView.BranchText>
                  {onCreateDocument && (
                    <Tooltip content="Create a file in this folder">
                      <IconButton
                        aria-label={`Create file in ${
                          node.value.slice("directory:".length)
                        }`}
                        color="fg.muted"
                        marginStart="auto"
                        size="xs"
                        variant="ghost"
                        onPointerDown={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onCreateDocument(
                            node.value.slice("directory:".length),
                          );
                        }}
                      >
                        <Plus aria-hidden="true" />
                      </IconButton>
                    </Tooltip>
                  )}
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
  );
};
