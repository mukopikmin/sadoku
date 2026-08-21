import type { CodeWrapMode, PreviewSettings, ThemeMode } from "../models/theme";

export type SettingsResponse = {
  codeWrap?: unknown;
  maxDepth?: unknown;
  maxFiles?: unknown;
  theme?: unknown;
};

export type SettingsUpdate = {
  codeWrap: CodeWrapMode;
  maxDepth: number;
  maxFiles: number;
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
  if (!Number.isInteger(maxDepth) || (maxDepth as number) < 0) {
    throw new Error("Settings response contained an invalid maximum depth.");
  }
  if (!Number.isInteger(maxFiles) || (maxFiles as number) < 1) {
    throw new Error(
      "Settings response contained an invalid maximum file count.",
    );
  }
  return {
    codeWrap: response.codeWrap,
    maxDepth: maxDepth as number,
    maxFiles: maxFiles as number,
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
