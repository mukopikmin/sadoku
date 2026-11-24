import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { loadSettings, saveSettings } from "../api/settings";
import { errorMessage } from "../models/uiState";
import type {
  CodeWrapMode,
  PreviewSettings,
  ResolvedPreviewSettings,
  ThemeMode,
} from "../models/theme";

export const settingsQueryKey = ["settings"] as const;
const settingsQueryOptions = {
  queryFn: loadSettings,
  queryKey: settingsQueryKey,
};

const getPreferredThemeMode = (): ThemeMode =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

type SettingsChanges = Partial<ResolvedPreviewSettings>;

export const usePreviewSettings = () => {
  const [defaults] = useState<ResolvedPreviewSettings>(() => ({
    showHighlightBoundaries: false,
    showHtmlComments: true,
    codeWrap: "scroll",
    excludedDirectories: [".git", "node_modules"],
    fontScale: 1,
    markdownExtensions: [".md", ".markdown"],
    maxDepth: 2,
    maxFiles: 20,
    theme: getPreferredThemeMode(),
    wideLayout: false,
  }));
  const [pendingChanges, setPendingChanges] = useState<SettingsChanges>({});
  // Consecutive events can stage changes before React renders them.
  const latestChanges = useRef(pendingChanges);
  const stageChanges = (changes: SettingsChanges) => {
    latestChanges.current = changes;
    setPendingChanges(changes);
  };
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(settingsQueryOptions);
  const resolveSettings = (
    saved?: PreviewSettings,
  ): ResolvedPreviewSettings => ({
    ...defaults,
    ...saved,
    codeWrap: saved?.codeWrap ?? defaults.codeWrap,
    theme: saved?.theme ?? defaults.theme,
  });
  const saveMutation = useMutation({
    mutationFn: async (changes: SettingsChanges) => {
      const saved = await queryClient.ensureQueryData(settingsQueryOptions);
      return saveSettings({
        ...resolveSettings(saved),
        ...changes,
        wideLayout: changes.wideLayout,
      });
    },
    scope: { id: "preview-settings" },
    onSuccess: (settings, changes) => {
      queryClient.setQueryData(settingsQueryKey, settings);
      if (latestChanges.current === changes) stageChanges({});
    },
  });
  const settings = {
    ...resolveSettings(settingsQuery.data),
    ...pendingChanges,
  };

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
    globalThis.document.documentElement.dataset.wideLayout = String(
      settings.wideLayout,
    );
  }, [settings.wideLayout]);

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

  const changeSettings = (changes: SettingsChanges) => {
    const next = { ...latestChanges.current, ...changes };
    stageChanges(next);
    saveMutation.mutate(next);
  };

  const retrySettings = () => {
    if (saveMutation.isError) {
      saveMutation.mutate(saveMutation.variables);
    } else {
      void settingsQuery.refetch();
    }
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

  const changeWideLayout = (next: boolean) => {
    changeSettings({ wideLayout: next });
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
    changeWideLayout,
    retrySettings,
    state: settingsState(
      settings,
      (settingsQuery.isPending || settingsQuery.isFetching) &&
        settingsQuery.data === undefined,
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
  if (loading) return { status: "loading", settings };
  if (loadError)
    return {
      status: "error",
      operation: "load",
      message: errorMessage(loadError),
      settings,
    };
  return { status: "ready", settings };
};
