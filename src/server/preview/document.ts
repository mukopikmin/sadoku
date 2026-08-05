import { readConfig } from "../../config.ts";
import { noStoreJson } from "../responses.ts";
import { readMarkdownSource, sourceTitle, sourceUrl } from "../source.ts";

export const handlePreviewDocumentRequest = async (
  documentSource: string,
): Promise<Response> => {
  const markdown = await readMarkdownSource(documentSource);
  const config = readConfig();
  return noStoreJson({
    title: sourceTitle(documentSource),
    fileUrl: sourceUrl(documentSource),
    markdown,
    markdownFontScale: config?.markdownFontScale,
  });
};
