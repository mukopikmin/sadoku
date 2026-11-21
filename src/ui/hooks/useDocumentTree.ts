import { useMemo, useState } from "react";
import type { DocumentSummary } from "../models/document";
import {
  collectDocumentTags,
  createDocumentTree,
  filterDocumentsByTags,
  filterTagsBySearch,
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
  const selectedTags = useMemo(
    () => tags.filter((tag) => activeTagIds.includes(tag.id)),
    [activeTagIds, tags],
  );
  const matchingTags = useMemo(
    () => filterTagsBySearch(tags, tagSearch),
    [tags, tagSearch],
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
      selectedTags,
      matchingTags,
      filteredDocuments,
      rootNode,
      tagSearch,
    },
    selectTag: (id: number) => {
      setSelectedTagIds((current) => {
        const active = reconcileSelectedTagIds(current, tags);
        if (active.includes(id)) return active.filter((value) => value !== id);
        return [...active, id];
      });
      setTagSearch("");
    },
    removeTag: (id: number) => {
      setSelectedTagIds((current) => current.filter((value) => value !== id));
    },
    setTagSearch,
    clear: () => {
      setSelectedTagIds([]);
      setTagSearch("");
    },
  };
};
