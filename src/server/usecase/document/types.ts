export type Document = {
  id: number;
  filePath: string;
};

export type DirectoryDocument = Document & {
  relativePath: string;
};

export type MarkdownDocumentPath = {
  absolutePath: string;
  relativePath: string;
};
