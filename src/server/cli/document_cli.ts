import { createPreviewSource } from "../source.ts";
import type {
  DocumentStore,
  DocumentTagReader,
} from "../usecase/document/mod.ts";
import {
  getDocument,
  listDocuments,
  registerDocument,
} from "../usecase/document/mod.ts";

export const addDocument = (input: string, store: DocumentStore) =>
  registerDocument(store, createPreviewSource(input).commentSource);

export const inspectDocument = (
  id: number,
  store: DocumentStore,
  tags?: DocumentTagReader,
) => getDocument(store, id, tags);

export const listRegisteredDocuments = (
  store: DocumentStore,
  tags?: DocumentTagReader,
) => listDocuments(store, tags);
