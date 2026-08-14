import type { CommentsStore } from "./storage.ts";
import { createConfiguredStores } from "../factory.ts";

export type ConfiguredCommentsStore = CommentsStore & {
  close: () => void;
};

export const createConfiguredCommentsStore = async (): Promise<
  ConfiguredCommentsStore
> => {
  const stores = await createConfiguredStores();
  return {
    ...stores.comments,
    close: stores.close,
  };
};
