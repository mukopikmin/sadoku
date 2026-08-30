import { noStoreJson, notFoundResponse, textResponse } from "../responses.ts";
import { isInstructionError } from "../usecase/instruction/errors.ts";
import {
  addInstruction,
  deleteInstruction,
  listInstructions,
  updateInstruction,
} from "../usecase/instruction/mod.ts";
import type { InstructionStore } from "../usecase/instruction/ports.ts";

const dependencies = (instructionStore: InstructionStore) => ({
  instructionStore,
  now: () => new Date().toISOString(),
});

const readContent = async (request: Request): Promise<string | Response> => {
  const body = await request.json().catch(() => undefined);
  if (
    typeof body !== "object" || body === null || !("content" in body) ||
    typeof body.content !== "string"
  ) {
    return textResponse(
      "Request body must contain an instruction content string.",
      400,
    );
  }
  return body.content;
};

const mapError = (error: unknown): Response => {
  if (!isInstructionError(error)) throw error;
  return error.type === "instruction_not_found"
    ? notFoundResponse("Instruction not found.")
    : textResponse("Instruction content must not be empty.", 400);
};

export const getInstructions = async (
  documentId: number,
  store: InstructionStore,
): Promise<Response> =>
  noStoreJson({ instructions: await listInstructions(store, documentId) });

export const createInstruction = async (
  request: Request,
  documentId: number,
  store: InstructionStore,
): Promise<Response> => {
  const content = await readContent(request);
  if (content instanceof Response) return content;
  try {
    return noStoreJson(
      await addInstruction(dependencies(store), documentId, content),
      201,
    );
  } catch (error) {
    return mapError(error);
  }
};

export const replaceInstruction = async (
  request: Request,
  documentId: number,
  instructionId: number,
  store: InstructionStore,
): Promise<Response> => {
  const content = await readContent(request);
  if (content instanceof Response) return content;
  try {
    return noStoreJson(
      await updateInstruction(
        dependencies(store),
        documentId,
        instructionId,
        content,
      ),
    );
  } catch (error) {
    return mapError(error);
  }
};

export const removeInstruction = async (
  documentId: number,
  instructionId: number,
  store: InstructionStore,
): Promise<Response> => {
  try {
    await deleteInstruction(store, documentId, instructionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return mapError(error);
  }
};
