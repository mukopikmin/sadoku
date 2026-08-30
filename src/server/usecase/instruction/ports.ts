import type { DocumentInstruction } from "./types.ts";

export type InstructionStore = {
  create: (
    documentId: number,
    content: string,
    now: string,
  ) => Promise<DocumentInstruction>;
  delete: (documentId: number, instructionId: number) => Promise<boolean>;
  listByDocument: (documentId: number) => Promise<DocumentInstruction[]>;
  update: (
    documentId: number,
    instructionId: number,
    content: string,
    now: string,
  ) => Promise<DocumentInstruction | undefined>;
};

export type InstructionDependencies = {
  instructionStore: InstructionStore;
  now: () => string;
};
