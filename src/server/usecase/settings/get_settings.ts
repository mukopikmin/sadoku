import type { SettingsStore } from "./ports.ts";
export const getSettings = (store: SettingsStore) => store.read();
