import { noStoreJson, textResponse } from "../responses.ts";
import type { TagStore } from "../usecase/tag/ports.ts";
import { replaceDocumentTags } from "../usecase/tag/replace_document_tags.ts";
import type { TagError } from "../usecase/tag/types.ts";

const errorResponse = (error: TagError) =>
  textResponse(
    error.message,
    error.type === "invalid" ? 400 : error.type === "not_found" ? 404 : 409,
  );
const json = async (request: Request): Promise<unknown | Response> => {
  try {
    return await request.json();
  } catch {
    return textResponse("Request body must be valid JSON.", 400);
  }
};
const isError = (value: unknown): value is TagError =>
  !!value && typeof value === "object" && "type" in value;

export const listTags = async (store: TagStore) =>
  noStoreJson(await store.list());
export const putDocumentTags = async (
  request: Request,
  documentId: number,
  store: TagStore,
) => {
  const body = await json(request);
  if (body instanceof Response) return body;
  const result = await replaceDocumentTags(
    store,
    documentId,
    (body as { tags?: unknown }).tags,
  );
  return isError(result) ? errorResponse(result) : noStoreJson(result);
};
