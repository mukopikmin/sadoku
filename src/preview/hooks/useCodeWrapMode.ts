import { useEffect, useState } from "react";

export type CodeWrapMode = "scroll" | "wrap";

const getStoredCodeWrapMode = (): CodeWrapMode => {
  try {
    const stored = globalThis.localStorage?.getItem("sadoku-code-wrap");
    if (stored === "scroll" || stored === "wrap") return stored;
  } catch {
    // Ignore storage failures and retain the default scrolling behavior.
  }

  return "scroll";
};

const persistCodeWrapMode = (codeWrapMode: CodeWrapMode): void => {
  try {
    globalThis.localStorage?.setItem("sadoku-code-wrap", codeWrapMode);
  } catch {
    // Code wrapping should keep working even when storage is unavailable.
  }
};

export const useCodeWrapMode = () => {
  const [codeWrapMode, setCodeWrapMode] = useState<CodeWrapMode>(
    getStoredCodeWrapMode,
  );

  useEffect(() => {
    globalThis.document.documentElement.dataset.codeWrap = codeWrapMode;
    persistCodeWrapMode(codeWrapMode);
  }, [codeWrapMode]);

  const toggleCodeWrapMode = () => {
    setCodeWrapMode((current) => current === "wrap" ? "scroll" : "wrap");
  };

  return { codeWrapMode, toggleCodeWrapMode };
};
