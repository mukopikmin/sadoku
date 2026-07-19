import type { SadokuConfig } from "../../config.ts";
import { openAppDatabase } from "../db/connection.ts";
import { createSqliteCommentsStore } from "./sqlite_storage.ts";
import { type CommentsStore, fileCommentsStore } from "./storage.ts";

export type ConfiguredCommentsStore = CommentsStore & {
  close?: () => void;
};

export const createConfiguredCommentsStore = async (
  config: SadokuConfig | undefined,
): Promise<ConfiguredCommentsStore> => {
  if (config?.experimental?.commentsStore === "sqlite") {
    const database = await openAppDatabase();
    return {
      ...createSqliteCommentsStore(database),
      close: () => database.close(),
    };
  }

  return fileCommentsStore;
};
