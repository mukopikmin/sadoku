import type { InstructionStore } from "./ports.ts";

export const deleteInstruction = async (
  store: InstructionStore,
  documentId: number,
  instructionId: number,
) => {
  if (!await store.delete(documentId, instructionId)) {
    throw { type: "instruction_not_found" } as const;
  }
};
