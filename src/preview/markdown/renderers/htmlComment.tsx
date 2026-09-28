import { Box, CodeBlock as ChakraCodeBlock, Text } from "@chakra-ui/react";
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
    <ChakraCodeBlock.Root
      bg="canvas.subtle"
      borderColor="border.muted"
      borderRadius="sm"
      borderStyle="dashed"
      borderLeftColor="warning.fg"
      borderLeftStyle="solid"
      borderLeftWidth="4px"
      code={typeof children === "string" ? children : ""}
      defaultColorScheme={document.documentElement.dataset.theme === "dark"
        ? "dark"
        : "light"}
      language="plaintext"
      m="0"
      overflow="hidden"
      {...elementProps}
      data-html-comment=""
    >
      <ChakraCodeBlock.Header
        borderBottomColor="border.muted"
        borderBottomStyle="dashed"
        borderBottomWidth="1px"
      >
        <ChakraCodeBlock.Title color="warning.fg">
          <MessageSquareText aria-hidden="true" size="1em" />
          HTML COMMENT
        </ChakraCodeBlock.Title>
      </ChakraCodeBlock.Header>
      <ChakraCodeBlock.Content maxH="unset">
        <Text
          color="fg.muted"
          fontSize="sm"
          px="4"
          py="3"
          whiteSpace="pre-wrap"
        >
          {children}
        </Text>
      </ChakraCodeBlock.Content>
    </ChakraCodeBlock.Root>
  </Box>
);

export const MarkdownHtmlComment = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"div">) => renderMarkdownHtmlComment(props, children);
