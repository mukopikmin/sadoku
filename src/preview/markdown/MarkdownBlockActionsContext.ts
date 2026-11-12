import { createContext } from "react";

// The selected block's gutter is shared by comments and block-specific actions.
export const MarkdownBlockActionsContext = createContext<HTMLElement | null>(
  null,
);
