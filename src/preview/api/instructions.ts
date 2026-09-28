import type { DocumentInstruction } from "../models/instruction";
import { previewClient } from "./connect";

type InstructionResponse = {
  content: unknown;
  createdAt: unknown;
  id: unknown;
  updatedAt: unknown;
};

type InstructionsResponse = { instructions: unknown };

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
  const body = await previewClient.listInstructions({
    documentId: BigInt(documentId),
  });
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
    await previewClient.createInstruction({
      documentId: BigInt(documentId),
      content,
    }),
  );
};

export const updateInstruction = async (
  documentId: number,
  instructionId: number,
  content: string,
) => {
  return toInstruction(
    await previewClient.updateInstruction({
      documentId: BigInt(documentId),
      instructionId: BigInt(instructionId),
      content,
    }),
  );
};

export const deleteInstruction = async (
  documentId: number,
  instructionId: number,
): Promise<void> => {
  await previewClient.deleteInstruction({
    documentId: BigInt(documentId),
    instructionId: BigInt(instructionId),
  });
};
