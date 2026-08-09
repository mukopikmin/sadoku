import type { CodeWrapMode, PreviewSettings, ThemeMode } from "../models/theme";

export type SettingsResponse = {
  codeWrap?: unknown;
  theme?: unknown;
};

export type SettingsUpdate = {
  codeWrap: CodeWrapMode;
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
  return { codeWrap: response.codeWrap, theme: response.theme };
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
