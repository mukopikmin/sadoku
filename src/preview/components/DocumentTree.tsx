import { Box, createTreeCollection, HStack, TreeView } from "@chakra-ui/react";
import { useMemo } from "react";
import type { DocumentSummary } from "../models/document";

type DocumentTreeNode = {
  children?: DocumentTreeNode[];
  documentId?: number;
  name: string;
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
          name: part,
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
  const rootNode = useMemo(() => createDocumentTree(documents), [documents]);
  const collection = useMemo(
    () =>
      createTreeCollection<DocumentTreeNode>({
        nodeToString: (node) => node.name,
        nodeToValue: (node) => node.value,
        rootNode,
      }),
    [rootNode],
  );

  return (
    <TreeView.Root
      collection={collection}
      defaultExpandedValue={getDirectoryValues(rootNode)}
      onSelectionChange={({ selectedNodes }) => {
        const selectedDocument = selectedNodes.find((node) =>
          node.documentId !== undefined
        );
        if (selectedDocument?.documentId !== undefined) {
          onSelectDocument(selectedDocument.documentId);
        }
      }}
    >
      <TreeView.Tree aria-label="Documents">
        <TreeView.Node<DocumentTreeNode>
          branchContentProps={{ ps: "5" }}
          indentGuide={
            <TreeView.BranchIndentGuide borderColor="border.muted" />
          }
          render={({ node, nodeState }) =>
            nodeState.isBranch
              ? (
                <TreeView.BranchControl>
                  <TreeView.BranchTrigger aria-label={`${node.name} folder`}>
                    <TreeView.BranchIndicator
                      color="fg.muted"
                      fontSize="xs"
                      transition="transform 0.15s"
                      _open={{ transform: "rotate(90deg)" }}
                    >
                      ▶
                    </TreeView.BranchIndicator>
                  </TreeView.BranchTrigger>
                  <HStack gap="2">
                    <Box aria-hidden="true" color="fg.muted">▰</Box>
                    <TreeView.BranchText>{node.name}</TreeView.BranchText>
                  </HStack>
                </TreeView.BranchControl>
              )
              : (
                <TreeView.Item cursor="pointer">
                  <HStack gap="2">
                    <Box aria-hidden="true" color="fg.muted">▤</Box>
                    <TreeView.ItemText>{node.name}</TreeView.ItemText>
                  </HStack>
                </TreeView.Item>
              )}
        />
      </TreeView.Tree>
    </TreeView.Root>
  );
};
