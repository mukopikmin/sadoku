import { readConfig, updatePreviewConfig } from "../config.ts";
import { noStoreJson, textResponse } from "../responses.ts";

const invalidRequest = (message: string): Response =>
  textResponse(message, 400);

const readSettings = () => {
  const config = readConfig();
  return {
    ...(config?.themeMode === undefined ? {} : { theme: config.themeMode }),
    ...(config?.codeWrapMode === undefined
      ? {}
      : { codeWrap: config.codeWrapMode }),
    ...(config?.defaultDirectory === undefined
      ? {}
      : { defaultDirectory: config.defaultDirectory }),
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

  const { codeWrap, defaultDirectory, theme } = body as Record<string, unknown>;
  const keys = Object.keys(body);
  if (
    (keys.length !== 2 && keys.length !== 3) ||
    keys.some((key) =>
      key !== "theme" && key !== "codeWrap" && key !== "defaultDirectory"
    ) ||
    (theme !== "dark" && theme !== "light") ||
    (codeWrap !== "scroll" && codeWrap !== "wrap") ||
    (defaultDirectory !== undefined && typeof defaultDirectory !== "string")
  ) {
    return invalidRequest(
      'Request body must contain theme ("dark" or "light"), codeWrap ("scroll" or "wrap"), and optionally defaultDirectory (a string).',
    );
  }

  await updatePreviewConfig(theme, codeWrap, defaultDirectory);
  return noStoreJson(readSettings());
};
