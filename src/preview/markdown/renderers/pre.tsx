import { Box } from "@chakra-ui/react";
import type React from "react";
import { CodeBlockContext } from "../codeBlockContext";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownPre = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box
    as="pre"
    overflow="auto"
    borderWidth="1px"
    borderColor="border.muted"
    borderRadius="sm"
    p="4"
    bg="canvas.subtle"
    color="code.fg"
    lineHeight="1.45"
    mt="0"
    mb="4"
    {...elementProps}
  >
    <CodeBlockContext.Provider value={true}>
      {children}
    </CodeBlockContext.Provider>
  </Box>
);

export const MarkdownPre = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"pre">) => renderMarkdownPre(props, children);
