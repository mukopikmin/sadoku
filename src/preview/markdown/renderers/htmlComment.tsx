import { Box, Flex, Text } from "@chakra-ui/react";
import { MessageSquareText } from "lucide-react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownHtmlComment = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box py="2">
    <Box
      bg="canvas.subtle"
      borderColor="border.muted"
      borderStyle="dashed"
      borderWidth="1px"
      borderLeftStyle="solid"
      borderLeftWidth="4px"
      borderRadius="sm"
      overflow="hidden"
      {...elementProps}
      data-html-comment=""
    >
      <Flex
        align="center"
        as="header"
        borderBottomColor="border.muted"
        borderBottomStyle="dashed"
        borderBottomWidth="1px"
        color="warning.fg"
        gap="1.5"
        minH="8"
        px="4"
      >
        <MessageSquareText aria-hidden="true" size="1em" />
        <Text as="span" fontSize="xs" fontWeight="medium">
          HTML COMMENT
        </Text>
      </Flex>
      <Text color="fg.muted" fontSize="sm" px="4" py="3" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  </Box>
);

export const MarkdownHtmlComment = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"div">) => renderMarkdownHtmlComment(props, children);
