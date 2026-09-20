import type { DocumentSummary, DocumentTag } from "./document";

export type DocumentTreeNode = {
  children?: DocumentTreeNode[];
  documentId?: number;
  deleted?: boolean;
  name: string;
  tags?: DocumentTag[];
  value: string;
};

export const createDocumentTree = (
  documents: DocumentSummary[],
): DocumentTreeNode => {
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

export const getDirectoryValues = (node: DocumentTreeNode): string[] =>
  (node.children ?? []).flatMap((child) =>
    child.children ? [child.value, ...getDirectoryValues(child)] : []
  );

export const collectDocumentTags = (
  documents: DocumentSummary[],
): DocumentTag[] => {
  const tagsById = new Map(
    documents.flatMap((document) => document.tags).map((tag) => [tag.id, tag]),
  );
  return [...tagsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
};

export const reconcileSelectedTagIds = (
  selectedTagIds: number[],
  tags: DocumentTag[],
): number[] => {
  const availableTagIds = new Set(tags.map(({ id }) => id));
  return selectedTagIds.filter((id) => availableTagIds.has(id));
};

export const filterTagsBySearch = (
  tags: DocumentTag[],
  searchValue: string,
): DocumentTag[] => {
  const search = searchValue.trim().toLocaleLowerCase();
  if (search.length === 0) return tags;
  return tags.filter((tag) => tag.name.toLocaleLowerCase().includes(search));
};

export const filterDocumentsByTags = (
  documents: DocumentSummary[],
  selectedTagIds: number[],
): DocumentSummary[] =>
  selectedTagIds.length === 0
    ? documents
    : documents.filter((document) =>
      document.tags.some((tag) => selectedTagIds.includes(tag.id))
    );
