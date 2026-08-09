import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { loadSettings, saveThemeSetting } from "../api/settings";
import type { ThemeMode } from "../models/theme";

export type { ThemeMode } from "../models/theme";

export const settingsQueryKey = ["settings"] as const;

const getPreferredThemeMode = (): ThemeMode => {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const useThemeMode = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getPreferredThemeMode);
  const userSelectedTheme = useRef(false);
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryFn: loadSettings,
    queryKey: settingsQueryKey,
  });
  const saveThemeMutation = useMutation({
    mutationFn: saveThemeSetting,
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQueryKey, settings);
    },
  });

  useEffect(() => {
    if (
      !userSelectedTheme.current && settingsQuery.data?.theme !== undefined
    ) {
      setThemeMode(settingsQuery.data.theme);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.dataset.theme = themeMode;
    root.classList.toggle("dark", themeMode === "dark");
    root.classList.toggle("light", themeMode === "light");
    root.style.colorScheme = themeMode;
  }, [themeMode]);

  const changeThemeMode = (next: ThemeMode) => {
    userSelectedTheme.current = true;
    setThemeMode(next);
    saveThemeMutation.mutate(next);
  };

  return { changeThemeMode, themeMode };
};
