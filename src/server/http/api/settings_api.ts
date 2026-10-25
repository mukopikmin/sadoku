import { readConfig, updatePreviewConfig } from "../../config/config.ts";
import { noStoreJson, textResponse } from "../responses.ts";
import {
  defaultDirectoryScanOptions,
  defaultExcludedDirectories,
  defaultMarkdownExtensions,
} from "../../storage/document/list_markdown_files.ts";
import type { SettingsStore } from "../../usecase/settings/ports.ts";
import {
  isSettingsError,
  type PreviewSettings,
  type SettingsError,
} from "../../usecase/settings/types.ts";
import { updateSettings as saveSettings } from "../../usecase/settings/update_settings.ts";
const readSettings = (): PreviewSettings => {
  const config = readConfig();
  return {
    ...(config?.themeMode === undefined ? {} : { theme: config.themeMode }),
    ...(config?.codeWrapMode === undefined
      ? {}
      : { codeWrap: config.codeWrapMode }),
    fontScale: config?.fontScale ?? 1,
    showHtmlComments: config?.showHtmlComments ?? true,
    excludedDirectories: config?.excludedDirectories ??
      [...defaultExcludedDirectories],
    maxDepth: config?.directoryMaxDepth ?? defaultDirectoryScanOptions.maxDepth,
    maxFiles: config?.directoryMaxFiles ?? defaultDirectoryScanOptions.maxFiles,
    markdownExtensions: config?.markdownExtensions ??
      [...defaultMarkdownExtensions],
  };
};

export const previewSettingsStore: SettingsStore = {
  read: readSettings,
  write: (settings) =>
    updatePreviewConfig(
      settings.theme,
      settings.codeWrap,
      settings.maxDepth,
      settings.maxFiles,
      settings.fontScale,
      settings.excludedDirectories,
      settings.markdownExtensions,
      settings.showHtmlComments,
    ),
};
export const getSettings = (): Response => noStoreJson(readSettings());
export const updateSettings = async (request: Request): Promise<Response> => {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();
  if (contentType !== "application/json") {
    return textResponse("Content-Type must be application/json.", 400);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return textResponse("Request body must be valid JSON.", 400);
  }
  try {
    return noStoreJson(await saveSettings(previewSettingsStore, body));
  } catch (error) {
    if (isSettingsError(error)) {
      return textResponse(settingsErrorMessage(error), 400);
    }
    throw error;
  }
};

export const settingsErrorMessage = (error: SettingsError): string =>
  error.reason === "object_required"
    ? "Request body must contain the complete preview settings."
    : "Request body must contain valid theme, codeWrap, fontScale, maxDepth, maxFiles, excludedDirectories, markdownExtensions, and showHtmlComments settings.";
