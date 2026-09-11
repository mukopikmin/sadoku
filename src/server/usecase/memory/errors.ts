export type MemoryError =
  | { type: "memory_content_empty" }
  | { type: "memory_not_found" };

export const isMemoryError = (error: unknown): error is MemoryError =>
  typeof error === "object" && error !== null && "type" in error &&
  (error.type === "memory_content_empty" ||
    error.type === "memory_not_found");
