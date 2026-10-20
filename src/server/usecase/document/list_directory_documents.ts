import type { DocumentTagReader } from "./ports.ts";
import type { DirectoryDocument, DirectoryDocumentSummary } from "./types.ts";
import { listDocumentTags } from "./list_document_tags.ts";

export const listDirectoryDocuments = (
  documents: readonly DirectoryDocument[],
  tagReader?: DocumentTagReader,
): Promise<DirectoryDocumentSummary[]> =>
  Promise.all(
    documents.map(
      async ({ deleted, id, relativePath, title, displayTitle }) => {
        const tags = await listDocumentTags(id, tagReader);
        return {
          deleted,
          id,
          relativePath,
          title,
          ...(displayTitle && { displayTitle }),
          ...(tags && { tags }),
        };
      },
    ),
  );
