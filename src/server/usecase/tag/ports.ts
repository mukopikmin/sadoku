import type { Tag, TagError, TagReference, TagSummary } from "./types.ts";

export interface TagStore {
  /** Add existing tags atomically, enforcing maxTags against the resulting set. */
  addForDocument(
    documentId: number,
    tagIds: readonly number[],
    maxTags: number,
  ): Promise<Tag[] | TagError>;
  deleteForDocument(
    documentId: number,
    tagIds: readonly number[],
  ): Promise<Tag[] | TagError>;
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
