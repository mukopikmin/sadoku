export type DocumentSummary = {
  deleted: boolean;
  id: number;
  relativePath: string;
  title: string;
};

export type PreviewDocument = {
  deleted: boolean;
  fileUrl: string;
  markdown: string;
  title: string;
};
