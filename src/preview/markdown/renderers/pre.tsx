import { Box, CodeBlock as ChakraCodeBlock } from "@chakra-ui/react";
import type React from "react";
import { CodeBlockContext } from "../codeBlockContext";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

const getCodeBlockText = (children: React.ReactNode): string => {
  if (
    children === null || children === undefined || typeof children === "boolean"
  ) {
    return "";
  }
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getCodeBlockText).join("");
  }
  if (typeof children === "object" && "props" in children) {
    return getCodeBlockText(
      (children as React.ReactElement<{ children?: React.ReactNode }>).props
        .children,
    );
  }
  return "";
};

const getCodeBlockLanguage = (
  children: React.ReactNode,
): string | undefined => {
  if (!children || Array.isArray(children) || typeof children !== "object") {
    return undefined;
  }
  if (!("props" in children)) return undefined;
  const className =
    (children as React.ReactElement<{ className?: string }>).props
      .className;
  return className?.split(/\s+/).find((name) => name.startsWith("language-"))
    ?.slice("language-".length);
};

export const renderMarkdownPre = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box py="2">
    <ChakraCodeBlock.Root
      code={getCodeBlockText(children)}
      language={getCodeBlockLanguage(children)}
      borderColor="border.muted"
      borderRadius="sm"
      bg="canvas.subtle"
      color="code.fg"
      lineHeight="1.5"
      m="0"
    >
      <ChakraCodeBlock.Content>
        <ChakraCodeBlock.Code
          overflow="auto"
          p="4"
          {...elementProps}
        >
          <CodeBlockContext.Provider value={true}>
            {children}
          </CodeBlockContext.Provider>
        </ChakraCodeBlock.Code>
      </ChakraCodeBlock.Content>
    </ChakraCodeBlock.Root>
  </Box>
);

export const MarkdownPre = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"pre">) => renderMarkdownPre(props, children);
