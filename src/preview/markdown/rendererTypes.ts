import type React from "react";

export type MarkdownComponentProps<
  TagName extends keyof React.JSX.IntrinsicElements,
> = React.JSX.IntrinsicElements[TagName] & {
  node?: unknown;
};

export type MarkdownElementProps = {
  id?: string;
  children?: React.ReactNode;
  className?: string;
};
