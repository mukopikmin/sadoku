import { normalizeInstructionContent } from "./add_instruction.ts";
import type { InstructionDependencies } from "./ports.ts";

export const updateInstruction = async (
  deps: InstructionDependencies,
  documentId: number,
  instructionId: number,
  content: string,
) => {
  const normalized = normalizeInstructionContent(content);
  if (normalized.trim().length === 0) {
    throw { type: "instruction_content_empty" } as const;
  }
  const instruction = await deps.instructionStore.update(
    documentId,
    instructionId,
    normalized,
    deps.now(),
  );
  if (!instruction) throw { type: "instruction_not_found" } as const;
  return instruction;
};
