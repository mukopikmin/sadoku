import { openAppDatabase } from "./db/connection.ts";
import { createSqliteCommentsStore } from "./comments/sqlite_storage.ts";
import type { CommentsStore } from "./comments/storage.ts";
import {
  ensureCommentsNotificationDirectory,
  notifyCommentsChanged,
} from "./comments/notifications.ts";
import { createSqliteDocumentStore } from "./documents/sqlite_storage.ts";
import type { DocumentStore } from "./documents/storage.ts";

export type ConfiguredStores = {
  close: () => void;
  comments: CommentsStore;
  documents: DocumentStore;
};

export const createConfiguredStores = async (): Promise<ConfiguredStores> => {
  const database = await openAppDatabase();
  try {
    await ensureCommentsNotificationDirectory();
  } catch (error) {
    database.close();
    throw error;
  }
  const comments = createSqliteCommentsStore(database);
  let closed = false;

  return {
    close: () => {
      if (closed) return;
      closed = true;
      database.close();
    },
    comments: {
      ...comments,
      delete: async (filePath) => {
        await comments.delete(filePath);
        await notifyCommentsChanged(filePath);
      },
      write: async (filePath, document) => {
        await comments.write(filePath, document);
        await notifyCommentsChanged(filePath);
      },
    },
    documents: createSqliteDocumentStore(database),
  };
};
