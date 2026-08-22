export type ThemeMode = "dark" | "light";
export type CodeWrapMode = "scroll" | "wrap";

export type PreviewSettings = {
  codeWrap?: CodeWrapMode;
  maxDepth: number;
  maxFiles: number;
  theme?: ThemeMode;
};
