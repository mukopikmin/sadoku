export type DocumentSummary = {
  deleted: boolean;
  id: number;
  relativePath: string;
  title: string;
  displayTitle?: string;
  tags: DocumentTag[];
};

export type DocumentTag = { backgroundColor: string; id: number; name: string };

export type PreviewDocument = {
  canRestore?: boolean;
  githubHeadSha?: string;
  deleted: boolean;
  fileUrl: string;
  markdown: string;
  previousMarkdown?: string;
  title: string;
  displayTitle?: string;
  tags: DocumentTag[];
};
