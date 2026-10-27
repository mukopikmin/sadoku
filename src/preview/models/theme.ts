export type ThemeMode = "dark" | "light";
export type CodeWrapMode = "scroll" | "wrap";

export type PreviewSettings = {
  showHtmlComments: boolean;
  codeWrap?: CodeWrapMode;
  excludedDirectories: string[];
  fontScale: number;
  maxDepth: number;
  maxFiles: number;
  markdownExtensions: string[];
  theme?: ThemeMode;
};

export type ResolvedPreviewSettings = PreviewSettings & {
  codeWrap: CodeWrapMode;
  theme: ThemeMode;
};
