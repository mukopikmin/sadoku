import type { PreviewSettings, ThemeMode } from "../models/theme";

export type SettingsResponse = {
  themeMode?: unknown;
};

const toPreviewSettings = (response: SettingsResponse): PreviewSettings => {
  if (
    response.themeMode !== undefined && response.themeMode !== "dark" &&
    response.themeMode !== "light"
  ) {
    throw new Error("Settings response contained an invalid theme mode.");
  }
  return { themeMode: response.themeMode };
};

export const loadSettings = async (): Promise<PreviewSettings> => {
  const response = await fetch("/__sadoku/settings");
  if (!response.ok) {
    throw new Error(`Failed to load settings: ${response.status}`);
  }
  return toPreviewSettings(await response.json() as SettingsResponse);
};

export const saveThemeSetting = async (
  themeMode: ThemeMode,
): Promise<PreviewSettings> => {
  const response = await fetch("/__sadoku/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ themeMode }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save settings: ${response.status}`);
  }
  return toPreviewSettings(await response.json() as SettingsResponse);
};
