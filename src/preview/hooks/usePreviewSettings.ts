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
  const [defaultDirectory, setDefaultDirectory] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(getPreferredThemeMode);
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
    setDefaultDirectory(settingsQuery.data.defaultDirectory ?? "");
    if (settingsQuery.data.theme !== undefined) {
      setThemeMode(settingsQuery.data.theme);
    }
  }, [settingsQuery.data]);

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
      ...(defaultDirectory ? { defaultDirectory } : {}),
      theme: themeMode,
    });
  };

  const changeThemeMode = (next: ThemeMode) => {
    userChangedSettings.current = true;
    setThemeMode(next);
    saveMutation.mutate({
      codeWrap: codeWrapMode,
      ...(defaultDirectory ? { defaultDirectory } : {}),
      theme: next,
    });
  };

  const changeDefaultDirectory = async (next: string): Promise<void> => {
    userChangedSettings.current = true;
    const settings = await saveMutation.mutateAsync({
      codeWrap: codeWrapMode,
      defaultDirectory: next,
      theme: themeMode,
    });
    setDefaultDirectory(settings.defaultDirectory ?? "");
  };

  return {
    changeCodeWrapMode,
    changeDefaultDirectory,
    changeThemeMode,
    codeWrapMode,
    defaultDirectory,
    themeMode,
  };
};
