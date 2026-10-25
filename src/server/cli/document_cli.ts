import { updateDocumentTitle } from "../usecase/document/update_document_title.ts";
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

export const addDocument = async (
  input: string,
  store: DocumentStore,
  title?: string,
) => {
  const document = await registerDocument(
    store,
    createPreviewSource(input).commentSource,
  );
  return title === undefined
    ? document
    : updateDocumentTitle(document, title, store);
};

export const inspectDocument = (
  id: number,
  store: DocumentStore,
  tags?: DocumentTagReader,
) => getDocument(store, id, tags);

export const listRegisteredDocuments = (
  store: DocumentStore,
  tags?: DocumentTagReader,
) => listDocuments(store, tags);
