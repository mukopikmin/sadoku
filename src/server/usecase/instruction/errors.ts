export type InstructionError =
  | { type: "instruction_content_empty" }
  | { type: "instruction_not_found" };

export const isInstructionError = (error: unknown): error is InstructionError =>
  typeof error === "object" && error !== null && "type" in error &&
  (error.type === "instruction_content_empty" ||
    error.type === "instruction_not_found");
