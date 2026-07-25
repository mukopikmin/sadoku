import { openAppDatabase } from "../db/connection.ts";
import { createSqliteCommentsStore } from "./sqlite_storage.ts";
import type { CommentsStore } from "./storage.ts";

export type ConfiguredCommentsStore = CommentsStore & {
  close: () => void;
};

export const createConfiguredCommentsStore = async (): Promise<
  ConfiguredCommentsStore
> => {
  const database = await openAppDatabase();
  return {
    ...createSqliteCommentsStore(database),
    close: () => database.close(),
  };
};
