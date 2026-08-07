import { join } from "@std/path";
import { getCommentsDirectoryPath } from "./paths.ts";

const notificationDirectoryName = "notifications";

const hashCommentSource = (source: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const getCommentsNotificationFilePath = (source: string): string =>
  join(
    getCommentsDirectoryPath(),
    notificationDirectoryName,
    `${hashCommentSource(source)}.changed`,
  );

export const notifyCommentsChanged = async (source: string): Promise<void> => {
  const path = getCommentsNotificationFilePath(source);
  await Deno.mkdir(
    join(getCommentsDirectoryPath(), notificationDirectoryName),
    {
      recursive: true,
    },
  );
  await Deno.writeTextFile(path, crypto.randomUUID());
};

export const ensureCommentsNotificationDirectory = async (): Promise<void> => {
  await Deno.mkdir(
    join(getCommentsDirectoryPath(), notificationDirectoryName),
    {
      recursive: true,
    },
  );
};
