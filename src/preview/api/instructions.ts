import type { DocumentInstruction } from "../models/instruction";
import { connectHttpStatus, previewClient } from "./connect";

type InstructionResponse = {
  content: unknown;
  createdAt: unknown;
  id: unknown;
  updatedAt: unknown;
};

type InstructionsResponse = { instructions: unknown };

const instructionRequest = async <T>(
  promise: Promise<T>,
  operation: string,
): Promise<T> => {
  try {
    return await promise;
  } catch (error) {
    throw new Error(`Failed to ${operation}: ${connectHttpStatus(error)}`);
  }
};

const toInstruction = (value: unknown): DocumentInstruction => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid instruction response.");
  }
  const response = value as InstructionResponse;
  if (
    (typeof response.id !== "number" && typeof response.id !== "bigint") ||
    Number(response.id) < 1 || typeof response.content !== "string" ||
    typeof response.createdAt !== "string" ||
    response.createdAt.length === 0 || typeof response.updatedAt !== "string" ||
    response.updatedAt.length === 0
  ) {
    throw new Error("Invalid instruction response.");
  }
  return {
    id: Number(response.id),
    content: response.content,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
};

export const loadInstructions = async (
  documentId: number,
): Promise<DocumentInstruction[]> => {
  const body = await instructionRequest(
    previewClient.listInstructions({ documentId: BigInt(documentId) }),
    "load instructions",
  );
  if (!Array.isArray(body.instructions)) {
    throw new Error("Invalid instructions response.");
  }
  return body.instructions.map(toInstruction);
};

export const createInstruction = async (
  documentId: number,
  content: string,
) => {
  return toInstruction(
    await instructionRequest(
      previewClient.createInstruction({
        documentId: BigInt(documentId),
        content,
      }),
      "create instruction",
    ),
  );
};

export const updateInstruction = async (
  documentId: number,
  instructionId: number,
  content: string,
) => {
  return toInstruction(
    await instructionRequest(
      previewClient.updateInstruction({
        documentId: BigInt(documentId),
        instructionId: BigInt(instructionId),
        content,
      }),
      "update instruction",
    ),
  );
};

export const deleteInstruction = async (
  documentId: number,
  instructionId: number,
): Promise<void> => {
  await instructionRequest(
    previewClient.deleteInstruction({
      documentId: BigInt(documentId),
      instructionId: BigInt(instructionId),
    }),
    "delete instruction",
  );
};
