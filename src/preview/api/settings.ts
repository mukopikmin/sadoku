import type { CodeWrapMode, PreviewSettings, ThemeMode } from "../models/theme";

export type SettingsResponse = {
  codeWrap?: unknown;
  excludedDirectories?: unknown;
  fontScale?: unknown;
  maxDepth?: unknown;
  maxFiles?: unknown;
  markdownExtensions?: unknown;
  theme?: unknown;
};

export type SettingsUpdate = {
  codeWrap: CodeWrapMode;
  excludedDirectories: string[];
  fontScale: number;
  maxDepth: number;
  maxFiles: number;
  markdownExtensions: string[];
  theme: ThemeMode;
};

const toPreviewSettings = (response: SettingsResponse): PreviewSettings => {
  if (
    response.theme !== undefined && response.theme !== "dark" &&
    response.theme !== "light"
  ) {
    throw new Error("Settings response contained an invalid theme mode.");
  }
  if (
    response.codeWrap !== undefined && response.codeWrap !== "scroll" &&
    response.codeWrap !== "wrap"
  ) {
    throw new Error("Settings response contained an invalid code wrap mode.");
  }
  const maxDepth = response.maxDepth ?? 2;
  const maxFiles = response.maxFiles ?? 20;
  const excludedDirectories = response.excludedDirectories ?? [
    ".git",
    "node_modules",
  ];
  const fontScale = response.fontScale ?? 1;
  const markdownExtensions = response.markdownExtensions ??
    [".md", ".markdown"];
  if (
    !Array.isArray(markdownExtensions) || markdownExtensions.length === 0 ||
    markdownExtensions.some((extension) =>
      typeof extension !== "string" || !/^\.[^.\\/]+$/.test(extension)
    ) ||
    new Set(markdownExtensions.map((extension) => extension.toLowerCase()))
        .size !==
      markdownExtensions.length
  ) {
    throw new Error("Settings response contained invalid Markdown extensions.");
  }
  if (
    typeof fontScale !== "number" || !Number.isFinite(fontScale) ||
    fontScale < 0.75 || fontScale > 1.5
  ) {
    throw new Error("Settings response contained an invalid font scale.");
  }
  if (!Number.isInteger(maxDepth) || (maxDepth as number) < 0) {
    throw new Error("Settings response contained an invalid maximum depth.");
  }
  if (!Number.isInteger(maxFiles) || (maxFiles as number) < 1) {
    throw new Error(
      "Settings response contained an invalid maximum file count.",
    );
  }
  if (
    !Array.isArray(excludedDirectories) ||
    excludedDirectories.some((directory) =>
      typeof directory !== "string" || directory.length === 0 ||
      directory === "." || directory === ".." || directory.includes("/") ||
      directory.includes("\\")
    ) || new Set(excludedDirectories).size !== excludedDirectories.length
  ) {
    throw new Error(
      "Settings response contained invalid excluded directories.",
    );
  }
  return {
    codeWrap: response.codeWrap,
    excludedDirectories,
    fontScale,
    maxDepth: maxDepth as number,
    maxFiles: maxFiles as number,
    markdownExtensions,
    theme: response.theme,
  };
};

export const loadSettings = async (): Promise<PreviewSettings> => {
  const response = await fetch("/__sadoku/settings");
  if (!response.ok) {
    throw new Error(`Failed to load settings: ${response.status}`);
  }
  return toPreviewSettings(await response.json() as SettingsResponse);
};

const saveSetting = async (
  update: SettingsUpdate,
): Promise<PreviewSettings> => {
  const response = await fetch("/__sadoku/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) {
    throw new Error(`Failed to save settings: ${response.status}`);
  }
  return toPreviewSettings(await response.json() as SettingsResponse);
};

export const saveSettings = saveSetting;
