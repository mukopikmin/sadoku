import { openAppDatabase } from "../../db/connection.ts";
import { createSqliteCommentsStore } from "./sqlite_storage.ts";
import type { CommentsStore } from "./storage.ts";
import {
  ensureCommentsNotificationDirectory,
  notifyCommentsChanged,
} from "./notifications.ts";

export type ConfiguredCommentsStore = CommentsStore & {
  close: () => void;
};

export const createConfiguredCommentsStore = async (): Promise<
  ConfiguredCommentsStore
> => {
  const database = await openAppDatabase();
  await ensureCommentsNotificationDirectory();
  const store = createSqliteCommentsStore(database);
  return {
    ...store,
    delete: async (filePath) => {
      await store.delete(filePath);
      await notifyCommentsChanged(filePath);
    },
    write: async (filePath, document) => {
      await store.write(filePath, document);
      await notifyCommentsChanged(filePath);
    },
    close: () => database.close(),
  };
};
