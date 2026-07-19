import type { Components } from "react-markdown";
import { MarkdownBlockquote } from "./renderers/blockquote";
import { MarkdownCode } from "./renderers/code";
import {
  MarkdownH1,
  MarkdownH2,
  MarkdownH3,
  MarkdownH4,
  MarkdownH5,
  MarkdownH6,
} from "./renderers/heading";
import { MarkdownHorizontalRule } from "./renderers/horizontalRule";
import { MarkdownImage } from "./renderers/image";
import { MarkdownInput } from "./renderers/input";
import { MarkdownLink } from "./renderers/link";
import { MarkdownListItem } from "./renderers/listItem";
import { MarkdownOrderedList } from "./renderers/orderedList";
import { MarkdownParagraph } from "./renderers/paragraph";
import { MarkdownPre } from "./renderers/pre";
import { MarkdownUnorderedList } from "./renderers/unorderedList";

export {
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "./markdownPlugins";
export { MarkdownListDepthContext, markdownListIndentEm } from "./listContext";
export type { MarkdownElementProps } from "./rendererTypes";
export { mergeClassNames } from "./rendererUtils";
export { renderMarkdownBlockquote } from "./renderers/blockquote";
export { renderMarkdownHeading } from "./renderers/heading";
export { renderMarkdownHorizontalRule } from "./renderers/horizontalRule";
export { renderMarkdownParagraph } from "./renderers/paragraph";
export { renderMarkdownPre } from "./renderers/pre";

export const sharedMarkdownComponents: Components = {
  a: MarkdownLink,
  blockquote: MarkdownBlockquote,
  code: MarkdownCode,
  h1: MarkdownH1,
  h2: MarkdownH2,
  h3: MarkdownH3,
  h4: MarkdownH4,
  h5: MarkdownH5,
  h6: MarkdownH6,
  hr: MarkdownHorizontalRule,
  img: MarkdownImage,
  input: MarkdownInput,
  li: MarkdownListItem,
  ol: MarkdownOrderedList,
  p: MarkdownParagraph,
  pre: MarkdownPre,
  ul: MarkdownUnorderedList,
};
