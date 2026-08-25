import { SEPARATOR } from "@std/path";

/** Converts an OS-native relative path to the platform-independent API form. */
export const toDocumentRelativePath = (
  path: string,
  separator = SEPARATOR,
): string => separator === "/" ? path : path.split(separator).join("/");
