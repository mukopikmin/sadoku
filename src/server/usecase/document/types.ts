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
