import { readConfig, updatePreviewConfig } from "../config.ts";
import { noStoreJson, textResponse } from "../responses.ts";
import { resolve } from "@std/path";

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

const resolveAccessibleDirectory = async (
  directory: string,
): Promise<string | Response> => {
  const path = resolve(directory);
  try {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      return invalidRequest(`Default folder is not a directory: ${path}`);
    }
    await Deno.readDir(path)[Symbol.asyncIterator]().next();
    return path;
  } catch (error) {
    const reason = error instanceof Deno.errors.NotFound
      ? "does not exist"
      : "cannot be accessed";
    return invalidRequest(`Default folder ${reason}: ${path}`);
  }
};

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

  let resolvedDefaultDirectory = defaultDirectory;
  if (defaultDirectory) {
    const resolved = await resolveAccessibleDirectory(defaultDirectory);
    if (resolved instanceof Response) return resolved;
    resolvedDefaultDirectory = resolved;
  }

  await updatePreviewConfig(theme, codeWrap, resolvedDefaultDirectory);
  return noStoreJson(readSettings());
};
