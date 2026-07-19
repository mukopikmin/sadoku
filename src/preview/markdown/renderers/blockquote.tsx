import { Box } from "@chakra-ui/react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownBlockquote = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box
    as="blockquote"
    borderColor="border.default"
    borderLeftWidth="4px"
    color="fg.muted"
    mt="0"
    mb="4"
    pl="4"
    {...elementProps}
  >
    {children}
  </Box>
);

export const MarkdownBlockquote = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"blockquote">) =>
  renderMarkdownBlockquote(props, children);
