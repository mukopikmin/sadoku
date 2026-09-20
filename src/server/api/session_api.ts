import { noStoreJson } from "../responses.ts";
import type { DirectorySession } from "../usecase/document/mod.ts";

export const getSession = (session: DirectorySession): Response =>
  noStoreJson({ pullRequest: session.pullRequest });
