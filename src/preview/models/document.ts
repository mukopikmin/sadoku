export type DocumentSummary = {
  deleted: boolean;
  id: number;
  relativePath: string;
  title: string;
  tags: DocumentTag[];
};

export type DocumentTag = { backgroundColor: string; id: number; name: string };

export type PreviewDocument = {
  githubHeadSha?: string;
  deleted: boolean;
  fileUrl: string;
  markdown: string;
  title: string;
  tags: DocumentTag[];
};
