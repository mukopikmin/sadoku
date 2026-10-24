import {
  isValidExcludedDirectories,
  isValidFontScale,
  isValidMarkdownExtensions,
} from "./validation.ts";
import type { SettingsStore } from "./ports.ts";
import type { SettingsError } from "./types.ts";
const invalid = (reason: SettingsError["reason"]): never => {
  throw { type: "invalid_settings", reason } satisfies SettingsError;
};
export const updateSettings = async (store: SettingsStore, body: unknown) => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid(
      "object_required",
    );
  }

  const {
    codeWrap,
    excludedDirectories,
    fontScale,
    maxDepth,
    maxFiles,
    markdownExtensions,
    theme,
    showHtmlComments,
  } = body as Record<
    string,
    unknown
  >;
  const allowedKeys = new Set([
    "codeWrap",
    "excludedDirectories",
    "fontScale",
    "markdownExtensions",
    "maxDepth",
    "maxFiles",
    "theme",
    "showHtmlComments",
  ]);
  if (
    Object.keys(body).some((key) => !allowedKeys.has(key)) ||
    (theme !== "dark" && theme !== "light") ||
    (codeWrap !== "scroll" && codeWrap !== "wrap") ||
    !isValidFontScale(fontScale) ||
    (showHtmlComments !== undefined && typeof showHtmlComments !== "boolean") ||
    (excludedDirectories !== undefined &&
      !isValidExcludedDirectories(excludedDirectories)) ||
    (markdownExtensions !== undefined &&
      !isValidMarkdownExtensions(markdownExtensions)) ||
    typeof maxDepth !== "number" || !Number.isInteger(maxDepth) ||
    maxDepth < 0 ||
    typeof maxFiles !== "number" || !Number.isInteger(maxFiles) || maxFiles < 1
  ) {
    return invalid(
      "invalid_values",
    );
  }

  const current = store.read();
  await store.write({
    theme,
    codeWrap,
    showHtmlComments: showHtmlComments ?? current.showHtmlComments,
    fontScale,
    maxDepth,
    maxFiles,
    excludedDirectories: excludedDirectories ?? current.excludedDirectories,
    markdownExtensions: markdownExtensions ?? current.markdownExtensions,
  });
  return store.read();
};
