import { basename, toFileUrl } from "@std/path";
import { noStoreJson } from "../responses.ts";

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const titleFromUrl = (url: URL): string => {
  const pathnameTitle = basename(decodeURIComponent(url.pathname));
  return pathnameTitle || url.hostname;
};

export const handlePreviewDocumentRequest = async (
  filePathOrUrl: string,
): Promise<Response> => {
  if (isHttpUrl(filePathOrUrl)) {
    const url = new URL(filePathOrUrl);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Markdown URL: ${response.status} ${response.statusText}`
          .trimEnd(),
      );
    }

    return noStoreJson({
      title: titleFromUrl(url),
      fileUrl: url.href,
      markdown: await response.text(),
    });
  }

  const markdown = await Deno.readTextFile(filePathOrUrl);
  return noStoreJson({
    title: basename(filePathOrUrl),
    fileUrl: toFileUrl(filePathOrUrl).href,
    markdown,
  });
};
