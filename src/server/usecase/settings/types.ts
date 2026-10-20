export type PreviewSettings = {
  theme?: "dark" | "light";
  codeWrap?: "scroll" | "wrap";
  fontScale: number;
  excludedDirectories: string[];
  maxDepth: number;
  maxFiles: number;
  markdownExtensions: string[];
};
export type CompletePreviewSettings = PreviewSettings & {
  theme: "dark" | "light";
  codeWrap: "scroll" | "wrap";
};
export type SettingsError = {
  type: "invalid_settings";
  reason: "object_required" | "invalid_values";
};

export const isSettingsError = (error: unknown): error is SettingsError =>
  typeof error === "object" && error !== null && "type" in error &&
  error.type === "invalid_settings" && "reason" in error &&
  (error.reason === "object_required" || error.reason === "invalid_values");
