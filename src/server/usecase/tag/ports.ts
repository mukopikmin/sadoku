import type { Tag, TagError, TagReference, TagSummary } from "./types.ts";

export interface TagStore {
  list(): Promise<TagSummary[]>;
  listForDocument(documentId: number): Promise<Tag[]>;
  replaceForDocument(
    documentId: number,
    references: readonly TagReference[],
  ): Promise<Tag[] | TagError>;
}
