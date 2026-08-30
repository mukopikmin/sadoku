import { Badge, Box, Text } from "@chakra-ui/react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownHtmlComment = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box
    bg="canvas.subtle"
    borderColor="border.muted"
    borderStyle="dashed"
    borderWidth="1px"
    borderLeftStyle="solid"
    borderLeftWidth="4px"
    px="4"
    py="3"
    {...elementProps}
    data-html-comment=""
  >
    <Badge
      aria-hidden="true"
      color="fg.muted"
      mb="2"
      variant="outline"
    >
      HTML COMMENT
    </Badge>
    <Text color="fg.muted" fontFamily="mono" whiteSpace="pre-wrap">
      {children}
    </Text>
  </Box>
);

export const MarkdownHtmlComment = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"div">) => renderMarkdownHtmlComment(props, children);
