import { useMemo, useState } from "react";
import type { DocumentSummary } from "../models/document";
import {
  collectDocumentTags,
  createDocumentTree,
  filterDocumentsByTags,
  reconcileSelectedTagIds,
} from "../models/documentTree";

export const useDocumentTree = (documents: DocumentSummary[]) => {
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

  return {
    state: {
      status: filteredDocuments.length
        ? ("ready" as const)
        : ("empty" as const),
      tags,
      activeTagIds,
      filteredDocuments,
      rootNode,
      tagSearch,
    },
    setSelectedTagIds,
    setTagSearch,
    clear: () => {
      setSelectedTagIds([]);
      setTagSearch("");
    },
  };
};
