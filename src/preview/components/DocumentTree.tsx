import { Badge, createTreeCollection, TreeView } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { DocumentSummary } from "../models/document";

type DocumentTreeNode = {
  children?: DocumentTreeNode[];
  documentId?: number;
  deleted?: boolean;
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
          deleted: document.deleted,
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

const FolderIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="1em"
    viewBox="0 0 24 24"
    width="1em"
  >
    <path
      d="M3 6.75A1.75 1.75 0 0 1 4.75 5h4.1l2 2h8.4A1.75 1.75 0 0 1 21 8.75v8.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

const FileIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="1em"
    viewBox="0 0 24 24"
    width="1em"
  >
    <path
      d="M6 3.75h7l5 5v11.5H6Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
    <path d="M13 3.75v5h5" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="1em"
    viewBox="0 0 24 24"
    width="1em"
  >
    <path
      d="m9 18 6-6-6-6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
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
                  <TreeView.BranchTrigger
                    aria-label={`${node.name} folder`}
                  >
                    <TreeView.BranchIndicator>
                      <ChevronRightIcon />
                    </TreeView.BranchIndicator>
                  </TreeView.BranchTrigger>
                  <FolderIcon />
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
                  <FileIcon />
                  <TreeView.ItemText>{node.name}</TreeView.ItemText>
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
