import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

const getPreferredThemeMode = (): ThemeMode => {
  try {
    const stored = globalThis.localStorage?.getItem("sadoku-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Ignore storage failures and fall back to the browser preference.
  }

  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const persistThemeMode = (themeMode: ThemeMode): void => {
  try {
    globalThis.localStorage?.setItem("sadoku-theme", themeMode);
  } catch {
    // Theme switching should keep working even when storage is unavailable.
  }
};

export const useThemeMode = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getPreferredThemeMode);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.dataset.theme = themeMode;
    root.classList.toggle("dark", themeMode === "dark");
    root.classList.toggle("light", themeMode === "light");
    root.style.colorScheme = themeMode;
    persistThemeMode(themeMode);
  }, [themeMode]);

  const toggleThemeMode = () => {
    setThemeMode((current) => current === "dark" ? "light" : "dark");
  };

  return { themeMode, toggleThemeMode };
};
