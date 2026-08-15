export type DocumentSummary = {
  id: number;
  relativePath: string;
  title: string;
};

export type PreviewDocument = {
  fileUrl: string;
  markdown: string;
  title: string;
};
