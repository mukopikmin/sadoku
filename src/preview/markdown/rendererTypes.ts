import type React from "react";
import type { ExtraProps } from "react-markdown";

export type MarkdownComponentProps<
  TagName extends keyof React.JSX.IntrinsicElements,
> = React.JSX.IntrinsicElements[TagName] & ExtraProps;

export type MarkdownElementProps = {
  id?: string;
  children?: React.ReactNode;
  className?: string;
};
