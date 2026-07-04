import type { SadokuConfig } from "../../config.ts";
import { type CommentsStore, fileCommentsStore } from "./storage.ts";

export type ConfiguredCommentsStore = CommentsStore & {
  close?: () => void;
};

const openSqliteCommentsStore = async (): Promise<ConfiguredCommentsStore> => {
  const connectionModulePath = "../db/connection.ts";
  const sqliteStorageModulePath = "./sqlite_storage.ts";
  const [{ openAppDatabase }, { createSqliteCommentsStore }] = await Promise
    .all([
      import(connectionModulePath),
      import(sqliteStorageModulePath),
    ]);
  const database = await openAppDatabase();
  return {
    ...createSqliteCommentsStore(database),
    close: () => database.close(),
  };
};

export const createConfiguredCommentsStore = async (
  config: SadokuConfig | undefined,
): Promise<ConfiguredCommentsStore> => {
  if (config?.experimental?.commentsStore === "sqlite") {
    return await openSqliteCommentsStore();
  }

  return fileCommentsStore;
};
