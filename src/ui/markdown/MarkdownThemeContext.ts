import { createContext } from "react";

export const MarkdownThemeContext = createContext<
  "dark" | "default" | undefined
>(undefined);
