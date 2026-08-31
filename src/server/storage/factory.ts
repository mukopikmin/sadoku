import { openAppDatabase } from "../db/connection.ts";
import { createSqliteCommentsStore } from "./comment/sqlite_storage.ts";
import type { CommentsStore } from "./comment/storage.ts";
import {
  ensureCommentsNotificationDirectory,
  notifyCommentsChanged,
} from "./comment/notifications.ts";
import { createSqliteDocumentStore } from "./document/sqlite_storage.ts";
import type { DocumentStore } from "../usecase/document/ports.ts";
import { createSqliteStatisticsReader } from "./statistics/sqlite_statistics.ts";
import type { StatisticsReader } from "../usecase/statistics/get_statistics.ts";
import { createSqliteInstructionStore } from "./instruction/sqlite_storage.ts";
import type { InstructionStore } from "../usecase/instruction/ports.ts";
import { createSqliteTagStore } from "./tag/sqlite_storage.ts";
import type { TagStore } from "../usecase/tag/ports.ts";

export type ConfiguredStores = {
  close: () => void;
  comments: CommentsStore;
  documents: DocumentStore;
  instructions: InstructionStore;
  statistics: StatisticsReader;
  tags: TagStore;
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
    instructions: createSqliteInstructionStore(database),
    statistics: createSqliteStatisticsReader(database),
    tags: createSqliteTagStore(database),
  };
};
