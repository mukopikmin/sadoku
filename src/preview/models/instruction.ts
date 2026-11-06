export type InstructionScope =
  { type: "global" } | { type: "document"; documentId: number };

export type DocumentInstruction = {
  content: string;
  createdAt: string;
  id: number;
  updatedAt: string;
};
