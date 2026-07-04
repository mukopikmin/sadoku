import type { SadokuConfig } from "../../config.ts";
import { openAppDatabase } from "../db/connection.ts";
import { createSqliteCommentsStore } from "./sqlite_storage.ts";
import { type CommentsStore, fileCommentsStore } from "./storage.ts";

export const createConfiguredCommentsStore = async (
  config: SadokuConfig | undefined,
): Promise<CommentsStore> => {
  if (config?.experimental?.commentsStore === "sqlite") {
    return createSqliteCommentsStore(await openAppDatabase());
  }

  return fileCommentsStore;
};
