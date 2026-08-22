import { createPreviewSource } from "../source.ts";
import type { DocumentStore } from "../usecase/document/mod.ts";
import {
  getDocument,
  listDocuments,
  registerDocument,
} from "../usecase/document/mod.ts";

export const addDocument = (input: string, store: DocumentStore) =>
  registerDocument(store, createPreviewSource(input).commentSource);

export const inspectDocument = (id: number, store: DocumentStore) =>
  getDocument(store, id);

export const listRegisteredDocuments = (store: DocumentStore) =>
  listDocuments(store);
