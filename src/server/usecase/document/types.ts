export type Document = {
  id: number;
  filePath: string;
};

export type DirectoryDocument = Document & {
  deleted: boolean;
  relativePath: string;
  title: string;
};

export type DirectorySession = {
  rootPath: string;
  documents: DirectoryDocument[];
  documentsById: Map<number, DirectoryDocument>;
};

export type MarkdownDocumentPath = {
  absolutePath: string;
  relativePath: string;
};

export type PublicDocumentTag = {
  backgroundColor: string;
  id: number;
  name: string;
};

export type DirectoryDocumentSummary =
  & Pick<
    DirectoryDocument,
    "deleted" | "id" | "relativePath" | "title"
  >
  & { tags?: PublicDocumentTag[] };

export type DirectoryDocumentContent = DirectoryDocumentSummary & {
  fileUrl?: string;
  markdown: string;
};
