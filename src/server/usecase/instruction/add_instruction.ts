import type { InstructionDependencies } from "./ports.ts";

export const normalizeInstructionContent = (content: string): string =>
  content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n+$/, "");

export const addInstruction = (
  deps: InstructionDependencies,
  documentId: number,
  content: string,
) => {
  const normalized = normalizeInstructionContent(content);
  if (normalized.trim().length === 0) {
    throw { type: "instruction_content_empty" } as const;
  }
  return deps.instructionStore.create(documentId, normalized, deps.now());
};
