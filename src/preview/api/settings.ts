import type { CodeWrapMode, PreviewSettings, ThemeMode } from "../models/theme";

export type SettingsResponse = {
  codeWrap?: unknown;
  defaultDirectory?: unknown;
  theme?: unknown;
};

export type SettingsUpdate = {
  codeWrap: CodeWrapMode;
  defaultDirectory?: string;
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
  if (
    response.defaultDirectory !== undefined &&
    typeof response.defaultDirectory !== "string"
  ) {
    throw new Error(
      "Settings response contained an invalid default directory.",
    );
  }
  return {
    codeWrap: response.codeWrap,
    defaultDirectory: response.defaultDirectory,
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

export type DirectoryListing = {
  directories: Array<{ name: string; path: string }>;
  parent?: string;
  path: string;
};

export const loadDirectories = async (
  path?: string,
): Promise<DirectoryListing> => {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const response = await fetch(`/__sadoku/settings/directories${query}`);
  if (!response.ok) {
    throw new Error(`Failed to load directories: ${response.status}`);
  }
  const body: unknown = await response.json();
  const value = body as Record<string, unknown>;
  if (
    typeof body !== "object" || body === null ||
    typeof value.path !== "string" ||
    (value.parent !== undefined && typeof value.parent !== "string") ||
    !Array.isArray(value.directories) ||
    value.directories.some((directory) =>
      typeof directory !== "object" || directory === null ||
      typeof (directory as Record<string, unknown>).name !== "string" ||
      typeof (directory as Record<string, unknown>).path !== "string"
    )
  ) {
    throw new Error("Directory listing response was invalid.");
  }
  return body as DirectoryListing;
};
