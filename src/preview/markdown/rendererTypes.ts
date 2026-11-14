import type React from "react";

export type MarkdownComponentProps<
  TagName extends keyof React.JSX.IntrinsicElements,
> = React.JSX.IntrinsicElements[TagName] & {
  node?: unknown;
  "data-markdown-alert"?: string;
};

export type MarkdownElementProps = {
  id?: string;
  "data-markdown-alert"?: string;
  children?: React.ReactNode;
  className?: string;
};
