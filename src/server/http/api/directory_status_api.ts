import type { DirectorySessionState } from "../../session/directory_session.ts";
import { noStoreJson } from "../responses.ts";

export const getDirectoryStatus = (state: DirectorySessionState): Response =>
  noStoreJson(state.status);
