export type ThemeMode = "dark" | "light";
export type CodeWrapMode = "scroll" | "wrap";

export type PreviewSettings = {
  codeWrap?: CodeWrapMode;
  excludedDirectories: string[];
  fontScale: number;
  maxDepth: number;
  maxFiles: number;
  markdownExtensions: string[];
  theme?: ThemeMode;
};
