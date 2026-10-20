import { readMarkdownSource, sourceUrl } from "./source.ts";
import { loadDirectoryDocument } from "../usecase/document/mod.ts";
import type {
  DirectorySession,
  DocumentStore,
} from "../usecase/document/mod.ts";
import type { TagStore } from "../usecase/tag/ports.ts";

export const readDirectoryDocument = async (
  document: DirectorySession["documents"][number],
  documentStore?: DocumentStore,
  tagStore?: TagStore,
  readMarkdown = readMarkdownSource,
) => {
  return await loadDirectoryDocument(document, {
    initializeSnapshot: documentStore?.initializeSnapshot
      ? (documentId, markdown) =>
        documentStore.initializeSnapshot!(documentId, markdown)
      : undefined,
    readMarkdown: async (source) => ({
      fileUrl: sourceUrl(source),
      markdown: await readMarkdown(source),
    }),
    readSnapshot: documentStore?.readSnapshot
      ? (documentId) => documentStore.readSnapshot!(documentId)
      : undefined,
    tagReader: tagStore,
  });
};
