import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { loadSettings, saveSettings } from "../api/settings";
import type { CodeWrapMode, ThemeMode } from "../models/theme";

export const settingsQueryKey = ["settings"] as const;

const getPreferredThemeMode = (): ThemeMode =>
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export const usePreviewSettings = () => {
  const [codeWrapMode, setCodeWrapMode] = useState<CodeWrapMode>("scroll");
  const [themeMode, setThemeMode] = useState<ThemeMode>(getPreferredThemeMode);
  const [fontScale, setFontScale] = useState(1);
  const [excludedDirectories, setExcludedDirectories] = useState<string[]>([
    ".git",
    "node_modules",
  ]);
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxFiles, setMaxFiles] = useState(20);
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
    if (settingsQuery.data.codeWrap !== undefined) {
      setCodeWrapMode(settingsQuery.data.codeWrap);
    }
    if (settingsQuery.data.theme !== undefined) {
      setThemeMode(settingsQuery.data.theme);
    }
    setFontScale(settingsQuery.data.fontScale);
    setExcludedDirectories(settingsQuery.data.excludedDirectories);
    setMaxDepth(settingsQuery.data.maxDepth);
    setMaxFiles(settingsQuery.data.maxFiles);
  }, [settingsQuery.data]);

  useEffect(() => {
    globalThis.document.documentElement.style.setProperty(
      "--sadoku-font-scale",
      String(fontScale),
    );
  }, [fontScale]);

  useEffect(() => {
    globalThis.document.documentElement.dataset.codeWrap = codeWrapMode;
  }, [codeWrapMode]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.dataset.theme = themeMode;
    root.classList.toggle("dark", themeMode === "dark");
    root.classList.toggle("light", themeMode === "light");
    root.style.colorScheme = themeMode;
  }, [themeMode]);

  const changeCodeWrapMode = (next: CodeWrapMode) => {
    userChangedSettings.current = true;
    setCodeWrapMode(next);
    saveMutation.mutate({
      codeWrap: next,
      excludedDirectories,
      fontScale,
      maxDepth,
      maxFiles,
      theme: themeMode,
    });
  };

  const changeThemeMode = (next: ThemeMode) => {
    userChangedSettings.current = true;
    setThemeMode(next);
    saveMutation.mutate({
      codeWrap: codeWrapMode,
      excludedDirectories,
      fontScale,
      maxDepth,
      maxFiles,
      theme: next,
    });
  };

  const changeFontScale = (next: number) => {
    userChangedSettings.current = true;
    setFontScale(next);
    saveMutation.mutate({
      codeWrap: codeWrapMode,
      excludedDirectories,
      fontScale: next,
      maxDepth,
      maxFiles,
      theme: themeMode,
    });
  };

  const changeDirectoryLimits = (
    nextMaxDepth: number,
    nextMaxFiles: number,
  ) => {
    userChangedSettings.current = true;
    setMaxDepth(nextMaxDepth);
    setMaxFiles(nextMaxFiles);
    saveMutation.mutate({
      codeWrap: codeWrapMode,
      excludedDirectories,
      fontScale,
      maxDepth: nextMaxDepth,
      maxFiles: nextMaxFiles,
      theme: themeMode,
    });
  };

  const changeExcludedDirectories = (next: string[]) => {
    userChangedSettings.current = true;
    setExcludedDirectories(next);
    saveMutation.mutate({
      codeWrap: codeWrapMode,
      excludedDirectories: next,
      fontScale,
      maxDepth,
      maxFiles,
      theme: themeMode,
    });
  };

  return {
    changeCodeWrapMode,
    changeDirectoryLimits,
    changeExcludedDirectories,
    changeFontScale,
    changeThemeMode,
    codeWrapMode,
    excludedDirectories,
    fontScale,
    maxDepth,
    maxFiles,
    themeMode,
  };
};
