import { readConfig, updatePreviewConfig } from "../../config.ts";
import {
  methodNotAllowedResponse,
  noStoreJson,
  textResponse,
} from "../responses.ts";

const invalidRequest = (message: string): Response =>
  textResponse(message, 400);

const readSettings = () => {
  const config = readConfig();
  return {
    ...(config?.themeMode === undefined ? {} : { theme: config.themeMode }),
    ...(config?.codeWrapMode === undefined
      ? {}
      : { codeWrap: config.codeWrapMode }),
  };
};

export const handleSettingsRequest = async (
  request: Request,
): Promise<Response> => {
  if (request.method === "GET") return noStoreJson(readSettings());
  if (request.method !== "PUT") return methodNotAllowedResponse();

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

  const { codeWrap, theme } = body as Record<string, unknown>;
  if (
    Object.keys(body).length !== 2 ||
    (theme !== "dark" && theme !== "light") ||
    (codeWrap !== "scroll" && codeWrap !== "wrap")
  ) {
    return invalidRequest(
      'Request body must contain only theme ("dark" or "light") and codeWrap ("scroll" or "wrap").',
    );
  }

  await updatePreviewConfig(theme, codeWrap);
  return noStoreJson(readSettings());
};
