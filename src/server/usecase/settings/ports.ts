import type { CompletePreviewSettings, PreviewSettings } from "./types.ts";
export type SettingsStore = {
  read: () => PreviewSettings;
  write: (settings: CompletePreviewSettings) => Promise<void>;
};
