import type React from "react";
import type { ExtraProps } from "react-markdown";

export type MarkdownComponentProps<
  TagName extends keyof React.JSX.IntrinsicElements,
> = React.JSX.IntrinsicElements[TagName] &
  ExtraProps & {
    "data-markdown-alert"?: string;
  };

export type MarkdownElementProps = {
  id?: string;
  "data-markdown-alert"?: string;
  children?: React.ReactNode;
  className?: string;
};
