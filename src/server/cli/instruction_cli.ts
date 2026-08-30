import { isInstructionError } from "../usecase/instruction/errors.ts";
import {
  addInstruction as addInstructionUseCase,
  deleteInstruction as deleteInstructionUseCase,
  listInstructions as listInstructionsUseCase,
  updateInstruction as updateInstructionUseCase,
} from "../usecase/instruction/mod.ts";
import type { InstructionStore } from "../usecase/instruction/ports.ts";

const dependencies = (instructionStore: InstructionStore) => ({
  instructionStore,
  now: () => new Date().toISOString(),
});

const mapUseCaseError = (error: unknown): never => {
  if (!isInstructionError(error)) throw error;
  if (error.type === "instruction_content_empty") {
    throw new Error("Instruction content must not be empty.");
  }
  throw new Error("Instruction not found.");
};

export const listInstructions = (
  documentId: number,
  store: InstructionStore,
) => listInstructionsUseCase(store, documentId);

export const addInstruction = async (
  documentId: number,
  content: string,
  store: InstructionStore,
) => {
  try {
    return await addInstructionUseCase(
      dependencies(store),
      documentId,
      content,
    );
  } catch (error) {
    return mapUseCaseError(error);
  }
};

export const updateInstruction = async (
  documentId: number,
  instructionId: number,
  content: string,
  store: InstructionStore,
) => {
  try {
    return await updateInstructionUseCase(
      dependencies(store),
      documentId,
      instructionId,
      content,
    );
  } catch (error) {
    return mapUseCaseError(error);
  }
};

export const deleteInstruction = async (
  documentId: number,
  instructionId: number,
  store: InstructionStore,
): Promise<void> => {
  try {
    await deleteInstructionUseCase(store, documentId, instructionId);
  } catch (error) {
    mapUseCaseError(error);
  }
};
