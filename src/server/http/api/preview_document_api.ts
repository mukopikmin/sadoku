import { noStoreJson } from "../responses.ts";
import {
  readMarkdownSource,
  sourceTitle,
  sourceUrl,
} from "../../session/source.ts";

export const handlePreviewDocumentRequest = async (
  documentSource: string,
): Promise<Response> => {
  const markdown = await readMarkdownSource(documentSource);
  return noStoreJson({
    title: sourceTitle(documentSource),
    fileUrl: sourceUrl(documentSource),
    markdown,
  });
};
