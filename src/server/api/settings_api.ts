import { readConfig, updatePreviewConfig } from "../config.ts";
import { noStoreJson, textResponse } from "../responses.ts";
import { defaultDirectoryScanOptions } from "../storage/document/list_markdown_files.ts";

const invalidRequest = (message: string): Response =>
  textResponse(message, 400);

const readSettings = () => {
  const config = readConfig();
  return {
    ...(config?.themeMode === undefined ? {} : { theme: config.themeMode }),
    ...(config?.codeWrapMode === undefined
      ? {}
      : { codeWrap: config.codeWrapMode }),
    maxDepth: config?.directoryMaxDepth ?? defaultDirectoryScanOptions.maxDepth,
    maxFiles: config?.directoryMaxFiles ?? defaultDirectoryScanOptions.maxFiles,
  };
};

export const getSettings = (): Response => noStoreJson(readSettings());

export const updateSettings = async (
  request: Request,
): Promise<Response> => {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();
  if (contentType !== "application/json") {
    return invalidRequest("Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("Request body must be valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalidRequest(
      "Request body must contain the complete preview settings.",
    );
  }

  const { codeWrap, maxDepth, maxFiles, theme } = body as Record<
    string,
    unknown
  >;
  if (
    Object.keys(body).length !== 4 ||
    (theme !== "dark" && theme !== "light") ||
    (codeWrap !== "scroll" && codeWrap !== "wrap") ||
    !Number.isInteger(maxDepth) || (maxDepth as number) < 0 ||
    !Number.isInteger(maxFiles) || (maxFiles as number) < 1
  ) {
    return invalidRequest(
      "Request body must contain valid theme, codeWrap, maxDepth, and maxFiles settings.",
    );
  }

  await updatePreviewConfig(
    theme,
    codeWrap,
    maxDepth as number,
    maxFiles as number,
  );
  return noStoreJson(readSettings());
};
