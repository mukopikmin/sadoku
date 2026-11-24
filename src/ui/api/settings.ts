import type { PreviewSettings, ResolvedPreviewSettings } from "../models/theme";
import type { Settings } from "../gen/sadoku/preview/v1/preview_pb";
import { previewClient } from "./connect";

type SettingsUpdate = Omit<ResolvedPreviewSettings, "wideLayout"> & {
  wideLayout?: boolean;
};

const toPreviewSettings = (response: Settings): PreviewSettings => {
  const {
    codeWrap,
    excludedDirectories,
    fontScale,
    markdownExtensions,
    maxDepth,
    maxFiles,
    theme,
  } = response;
  if (theme !== undefined && theme !== "dark" && theme !== "light") {
    throw new Error("Settings response contained an invalid theme mode.");
  }
  if (codeWrap !== undefined && codeWrap !== "scroll" && codeWrap !== "wrap") {
    throw new Error("Settings response contained an invalid code wrap mode.");
  }
  if (
    markdownExtensions.length === 0 ||
    markdownExtensions.some((extension) => !/^\.[^.\\/]+$/.test(extension)) ||
    new Set(markdownExtensions.map((extension) => extension.toLowerCase()))
      .size !== markdownExtensions.length
  ) {
    throw new Error("Settings response contained invalid Markdown extensions.");
  }
  if (!Number.isFinite(fontScale) || fontScale < 0.75 || fontScale > 1.5) {
    throw new Error("Settings response contained an invalid font scale.");
  }
  if (maxFiles < 1) {
    throw new Error(
      "Settings response contained an invalid maximum file count.",
    );
  }
  if (
    excludedDirectories.some(
      (directory) =>
        directory.length === 0 ||
        directory === "." ||
        directory === ".." ||
        directory.includes("/") ||
        directory.includes("\\"),
    ) ||
    new Set(excludedDirectories).size !== excludedDirectories.length
  ) {
    throw new Error(
      "Settings response contained invalid excluded directories.",
    );
  }
  return {
    showHighlightBoundaries: response.showHighlightBoundaries ?? false,
    showHtmlComments: response.showHtmlComments ?? true,
    codeWrap,
    excludedDirectories,
    fontScale,
    maxDepth,
    maxFiles,
    markdownExtensions,
    theme,
    wideLayout: response.wideLayout ?? false,
  };
};

export const loadSettings = async (): Promise<PreviewSettings> => {
  return toPreviewSettings(await previewClient.getSettings({}));
};

export const saveSettings = async (
  update: SettingsUpdate,
): Promise<PreviewSettings> => {
  return toPreviewSettings(await previewClient.updateSettings(update));
};
