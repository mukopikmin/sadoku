export type DocumentRevisionSummary = {
  id: number;
  recordedAt: string;
};

export type DocumentRevision = DocumentRevisionSummary & { markdown: string };
