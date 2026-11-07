import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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

export const usePreviewSettings = () => {
  const [settings, setSettings] = useState<ResolvedPreviewSettings>(() => ({
    showHighlightBoundaries: false,
    showHtmlComments: true,
    codeWrap: "scroll",
    excludedDirectories: [".git", "node_modules"],
    fontScale: 1,
    markdownExtensions: [".md", ".markdown"],
    maxDepth: 2,
    maxFiles: 20,
    theme: getPreferredThemeMode(),
  }));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const userChangedSettings = useRef(false);
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryFn: loadSettings,
    queryKey: settingsQueryKey,
  });
  const saveMutation = useMutation({
    mutationFn: saveSettings,
    scope: { id: "preview-settings" },
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKey, settings);
    },
  });

  useEffect(() => {
    if (userChangedSettings.current || settingsQuery.data === undefined) return;
    setSettings((current) => ({
      ...current,
      ...settingsQuery.data,
      codeWrap: settingsQuery.data.codeWrap ?? current.codeWrap,
      theme: settingsQuery.data.theme ?? current.theme,
    }));
  }, [settingsQuery.data]);

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
    userChangedSettings.current = true;
    const next = { ...settingsRef.current, ...changes };
    settingsRef.current = next;
    setSettings(next);
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
    state: settingsState(
      settings,
      settingsQuery.isPending,
      settingsQuery.error,
      saveMutation.isPending,
      saveMutation.error,
      userChangedSettings.current,
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
  changed: boolean,
): PreviewSettingsState => {
  if (saving) return { status: "saving", settings };
  if (saveError)
    return {
      status: "error",
      operation: "save",
      message: errorMessage(saveError),
      settings,
    };
  if (!changed && loadError)
    return {
      status: "error",
      operation: "load",
      message: errorMessage(loadError),
      settings,
    };
  return { status: !changed && loading ? "loading" : "ready", settings };
};
