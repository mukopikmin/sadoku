import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../api/settings";
import { errorMessage } from "../models/uiState";
import type {
  CodeWrapMode,
  ResolvedPreviewSettings,
  ThemeMode,
} from "../models/theme";

export const settingsQueryKey = ["settings"] as const;

const getPreferredThemeMode = (): ThemeMode =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const settingsOptions = queryOptions({
  queryFn: loadSettings,
  queryKey: settingsQueryKey,
  // The preview owns edits once loaded. Reload explicitly after a load failure.
  staleTime: Infinity,
});

const defaults = {
  showHighlightBoundaries: false,
  showHtmlComments: true,
  codeWrap: "scroll",
  excludedDirectories: [".git", "node_modules"],
  fontScale: 1,
  markdownExtensions: [".md", ".markdown"],
  maxDepth: 2,
  maxFiles: 20,
} satisfies Omit<ResolvedPreviewSettings, "theme">;

export const usePreviewSettings = () => {
  const [preferredTheme] = useState(getPreferredThemeMode);
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(settingsOptions);
  const resolveSettings = (
    value: typeof settingsQuery.data,
  ): ResolvedPreviewSettings => ({
    ...defaults,
    ...value,
    codeWrap: value?.codeWrap ?? defaults.codeWrap,
    theme: value?.theme ?? preferredTheme,
  });
  const settings = resolveSettings(settingsQuery.data);
  const saveMutation = useMutation({
    mutationFn: saveSettings,
    scope: { id: "preview-settings" },
  });

  useEffect(() => {
    globalThis.document.documentElement.style.setProperty(
      "--sadoku-font-scale",
      String(settings.fontScale),
    );
  }, [settings.fontScale]);

  useEffect(() => {
    globalThis.document.documentElement.dataset.codeWrap = settings.codeWrap;
  }, [settings.codeWrap]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.dataset.showHighlightBoundaries = String(
      settings.showHighlightBoundaries,
    );
  }, [settings.showHighlightBoundaries]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.dataset.theme = settings.theme;
    root.classList.toggle("dark", settings.theme === "dark");
    root.classList.toggle("light", settings.theme === "light");
    root.style.colorScheme = settings.theme;
  }, [settings.theme]);

  const changeSettings = (changes: Partial<ResolvedPreviewSettings>) => {
    const current = queryClient.getQueryData(settingsOptions.queryKey);
    if (!current) return;
    const next = { ...resolveSettings(current), ...changes };
    queryClient.setQueryData(settingsOptions.queryKey, next);
    saveMutation.mutate(next);
  };

  const changeCodeWrapMode = (next: CodeWrapMode) => {
    changeSettings({ codeWrap: next });
  };

  const changeShowHtmlComments = (next: boolean) => {
    changeSettings({ showHtmlComments: next });
  };

  const changeShowHighlightBoundaries = (next: boolean) => {
    changeSettings({ showHighlightBoundaries: next });
  };

  const changeThemeMode = (next: ThemeMode) => {
    changeSettings({ theme: next });
  };

  const changeFontScale = (next: number) => {
    changeSettings({ fontScale: next });
  };

  const changeDirectoryLimits = (
    nextMaxDepth: number,
    nextMaxFiles: number,
  ) => {
    changeSettings({
      maxDepth: nextMaxDepth,
      maxFiles: nextMaxFiles,
    });
  };

  const changeExcludedDirectories = (next: string[]) => {
    changeSettings({ excludedDirectories: next });
  };

  const changeMarkdownExtensions = (next: string[]) => {
    changeSettings({ markdownExtensions: next });
  };

  return {
    changeCodeWrapMode,
    changeDirectoryLimits,
    changeExcludedDirectories,
    changeFontScale,
    changeMarkdownExtensions,
    changeShowHighlightBoundaries,
    changeShowHtmlComments,
    changeThemeMode,
    reloadSettings: () => {
      void settingsQuery.refetch();
    },
    state: settingsState(
      settings,
      settingsQuery.isPending,
      settingsQuery.error,
      saveMutation.isPending,
      saveMutation.error,
    ),
  };
};

export type PreviewSettingsState = { settings: ResolvedPreviewSettings } & (
  | { status: "loading" | "ready" | "saving" }
  | { status: "error"; operation: "load" | "save"; message: string }
);

const settingsState = (
  settings: ResolvedPreviewSettings,
  loading: boolean,
  loadError: Error | null,
  saving: boolean,
  saveError: Error | null,
): PreviewSettingsState => {
  if (saving) return { status: "saving", settings };
  if (saveError)
    return {
      status: "error",
      operation: "save",
      message: errorMessage(saveError),
      settings,
    };
  if (loadError)
    return {
      status: "error",
      operation: "load",
      message: errorMessage(loadError),
      settings,
    };
  return { status: loading ? "loading" : "ready", settings };
};
