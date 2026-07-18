import { Text } from "@chakra-ui/react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownParagraph = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Text as="p" mt="0" mb="4" {...elementProps}>
    {children}
  </Text>
);

export const MarkdownParagraph = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"p">) => renderMarkdownParagraph(props, children);
