import type { Tag, TagError, TagReference, TagSummary } from "./types.ts";

export interface TagStore {
  create(name: string, backgroundColor: string): Promise<Tag | TagError>;
  delete(id: number): Promise<void | TagError>;
  list(): Promise<TagSummary[]>;
  listForDocument(documentId: number): Promise<Tag[]>;
  rename(id: number, name: string): Promise<Tag | TagError>;
  update(
    id: number,
    name?: string,
    backgroundColor?: string,
  ): Promise<Tag | TagError>;
  replaceForDocument(
    documentId: number,
    references: readonly TagReference[],
  ): Promise<Tag[] | TagError>;
}
