import type { TagStore } from "./ports.ts";

export const listTags = (store: TagStore) => store.list();
