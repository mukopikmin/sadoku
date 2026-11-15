import { useState } from "react";
import {
  getDirectoryValues,
  type DocumentTreeNode,
} from "../models/documentTree";

export const useDocumentTreeExpansion = (
  root: DocumentTreeNode,
  onSelect: (id: number) => void,
) => {
  const [expandedValue, expand] = useState(() => getDirectoryValues(root));
  return {
    expandedValue,
    expand,
    select: (nodes: DocumentTreeNode[]) => {
      const selected = nodes.find((node) => node.documentId !== undefined);
      if (selected?.documentId !== undefined) onSelect(selected.documentId);
    },
  };
};
