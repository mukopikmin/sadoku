import type {
  DocumentTagReader,
  InitializeDocumentSnapshot,
  ReadDocumentSnapshot,
  ReadMarkdownDocument,
} from "./ports.ts";
import type { DirectoryDocument, DirectoryDocumentContent } from "./types.ts";
import { listDocumentTags } from "./list_document_tags.ts";
import { loadDeletedDocumentSnapshot } from "./load_deleted_document_snapshot.ts";
import { loadLiveDocument } from "./load_live_document.ts";

export type LoadDirectoryDocumentDependencies = {
  initializeSnapshot?: InitializeDocumentSnapshot;
  readMarkdown: ReadMarkdownDocument;
  readSnapshot?: ReadDocumentSnapshot;
  tagReader?: DocumentTagReader;
};

export const loadDirectoryDocument = async (
  document: DirectoryDocument,
  dependencies: LoadDirectoryDocumentDependencies,
): Promise<DirectoryDocumentContent> => {
  const content = document.deleted
    ? await loadDeletedDocumentSnapshot(document.id, dependencies.readSnapshot)
    : await loadLiveDocument(
      document,
      dependencies.readMarkdown,
      dependencies.initializeSnapshot,
    );
  const tags = await listDocumentTags(document.id, dependencies.tagReader);
  return {
    deleted: document.deleted,
    id: document.id,
    relativePath: document.relativePath,
    title: document.title,
    ...content,
    ...(tags && { tags }),
  };
};
