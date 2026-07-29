import { useEffect, useState } from "react";

const getStoredCodeBlockWrapping = (): boolean => {
  try {
    return globalThis.localStorage?.getItem("sadoku-code-wrap") === "true";
  } catch {
    return false;
  }
};

const persistCodeBlockWrapping = (wrapCodeBlocks: boolean): void => {
  try {
    globalThis.localStorage?.setItem(
      "sadoku-code-wrap",
      String(wrapCodeBlocks),
    );
  } catch {
    // Code wrapping should keep working when storage is unavailable.
  }
};

export const useCodeBlockWrapping = () => {
  const [wrapCodeBlocks, setWrapCodeBlocks] = useState(
    getStoredCodeBlockWrapping,
  );

  useEffect(() => persistCodeBlockWrapping(wrapCodeBlocks), [wrapCodeBlocks]);

  const toggleCodeBlockWrapping = () => {
    setWrapCodeBlocks((current) => !current);
  };

  return { toggleCodeBlockWrapping, wrapCodeBlocks };
};
