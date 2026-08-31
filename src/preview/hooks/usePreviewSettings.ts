import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { loadSettings, saveSettings } from "../api/settings";
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
    codeWrap: "scroll",
    excludedDirectories: [".git", "node_modules"],
    fontScale: 1,
    markdownExtensions: [".md", ".markdown"],
    maxDepth: 2,
    maxFiles: 20,
    theme: getPreferredThemeMode(),
  }));
  const userChangedSettings = useRef(false);
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryFn: loadSettings,
    queryKey: settingsQueryKey,
  });
  const saveMutation = useMutation({
    mutationFn: saveSettings,
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
    root.dataset.theme = settings.theme;
    root.classList.toggle("dark", settings.theme === "dark");
    root.classList.toggle("light", settings.theme === "light");
    root.style.colorScheme = settings.theme;
  }, [settings.theme]);

  const changeSettings = (changes: Partial<ResolvedPreviewSettings>) => {
    userChangedSettings.current = true;
    const next = { ...settings, ...changes };
    setSettings(next);
    saveMutation.mutate(next);
  };

  const changeCodeWrapMode = (next: CodeWrapMode) => {
    changeSettings({ codeWrap: next });
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
    changeThemeMode,
    settings,
  };
};
