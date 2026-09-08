import type { DocumentTagReader } from "./ports.ts";
import type { PublicDocumentTag } from "./types.ts";

export const listDocumentTags = async (
  documentId: number,
  reader?: DocumentTagReader,
): Promise<PublicDocumentTag[] | undefined> =>
  reader
    ? (await reader.listForDocument(documentId)).map(
      ({ backgroundColor, id, name }) => ({ backgroundColor, id, name }),
    )
    : undefined;
