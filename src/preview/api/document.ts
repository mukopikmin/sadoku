import type { PreviewComment } from "./comments";

export type PreviewDocument = {
  fileUrl: string;
  markdown: string;
  title: string;
};

export type PreviewLoadState =
  | { status: "loading" }
  | {
    comments: PreviewComment[];
    document: PreviewDocument;
    status: "loaded";
  }
  | { message: string; status: "error" };

export const loadPreviewDocument = async (): Promise<PreviewDocument> => {
  const response = await fetch("/__sadoku/document");
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};
