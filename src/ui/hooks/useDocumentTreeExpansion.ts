import { useMemo, useState } from "react";
import {
  getDirectoryValues,
  type DocumentTreeNode,
} from "../models/documentTree";

export const useDocumentTreeExpansion = (
  root: DocumentTreeNode,
  onSelect: (id: number) => void,
  searchQuery = "",
) => {
  const [browseCollapsed, setBrowseCollapsed] = useState(
    () => new Set<string>(),
  );
  const [searchExpansion, setSearchExpansion] = useState(() => ({
    query: searchQuery,
    collapsed: new Set<string>(),
  }));
  if (searchExpansion.query !== searchQuery) {
    setSearchExpansion({ query: searchQuery, collapsed: new Set() });
  }

  const directories = useMemo(() => getDirectoryValues(root), [root]);
  const collapsed = searchQuery ? searchExpansion.collapsed : browseCollapsed;
  return {
    expandedValue: directories.filter((value) => !collapsed.has(value)),
    expand: (values: string[]) => {
      const expanded = new Set(values);
      const nextCollapsed = new Set(collapsed);
      for (const value of directories) {
        if (expanded.has(value)) nextCollapsed.delete(value);
        else nextCollapsed.add(value);
      }
      if (searchQuery) {
        setSearchExpansion({ query: searchQuery, collapsed: nextCollapsed });
      } else {
        setBrowseCollapsed(nextCollapsed);
      }
    },
    select: (nodes: DocumentTreeNode[]) => {
      const selected = nodes.find((node) => node.documentId !== undefined);
      if (selected?.documentId !== undefined) onSelect(selected.documentId);
    },
  };
};
