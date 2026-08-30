import type { DocumentInstruction } from "../models/instruction";

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
    typeof response.id !== "number" || typeof response.content !== "string" ||
    typeof response.createdAt !== "string" ||
    typeof response.updatedAt !== "string"
  ) {
    throw new Error("Invalid instruction response.");
  }
  return {
    id: response.id,
    content: response.content,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
};

const path = (documentId: number) =>
  `/__sadoku/documents/${documentId}/instructions`;

export const loadInstructions = async (
  documentId: number,
): Promise<DocumentInstruction[]> => {
  const response = await fetch(path(documentId));
  if (!response.ok) {
    throw new Error(`Failed to load instructions: ${response.status}`);
  }
  const body = await response.json() as InstructionsResponse;
  if (!Array.isArray(body.instructions)) {
    throw new Error("Invalid instructions response.");
  }
  return body.instructions.map(toInstruction);
};

export const createInstruction = async (
  documentId: number,
  content: string,
) => {
  const response = await fetch(path(documentId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create instruction: ${response.status}`);
  }
  return toInstruction(await response.json());
};

export const updateInstruction = async (
  documentId: number,
  instructionId: number,
  content: string,
) => {
  const response = await fetch(`${path(documentId)}/${instructionId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update instruction: ${response.status}`);
  }
  return toInstruction(await response.json());
};

export const deleteInstruction = async (
  documentId: number,
  instructionId: number,
): Promise<void> => {
  const response = await fetch(`${path(documentId)}/${instructionId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete instruction: ${response.status}`);
  }
};
