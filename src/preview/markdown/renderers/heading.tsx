import { Box } from "@chakra-ui/react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

const headingSizes = {
  h1: "1.8rem",
  h2: "1.4rem",
  h3: "1.15rem",
  h4: "0.95rem",
  h5: "0.8rem",
  h6: "0.8rem",
} as const;

type HeadingTagName = keyof typeof headingSizes;

export const renderMarkdownHeading = (
  tagName: HeadingTagName,
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box
    as={tagName}
    borderBottomWidth={tagName === "h1" || tagName === "h2" ? "1px" : "0"}
    borderColor="border.muted"
    color={tagName === "h6" ? "fg.muted" : undefined}
    fontSize={headingSizes[tagName]}
    fontWeight="semibold"
    lineHeight="1.25"
    m="0"
    pt="4"
    pb={tagName === "h1" || tagName === "h2" ? "0.3em" : "0"}
    {...elementProps}
  >
    {children}
  </Box>
);

const createMarkdownHeading = (tagName: HeadingTagName) =>
(
  { children, node: _node, ...props }: MarkdownComponentProps<HeadingTagName>,
) => renderMarkdownHeading(tagName, props, children);

export const MarkdownH1 = createMarkdownHeading("h1");
export const MarkdownH2 = createMarkdownHeading("h2");
export const MarkdownH3 = createMarkdownHeading("h3");
export const MarkdownH4 = createMarkdownHeading("h4");
export const MarkdownH5 = createMarkdownHeading("h5");
export const MarkdownH6 = createMarkdownHeading("h6");
