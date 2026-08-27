import type { PathExists } from "../../usecase/document/ports.ts";

export const pathExists: PathExists = async (filePath) => {
  try {
    await Deno.stat(filePath);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};
