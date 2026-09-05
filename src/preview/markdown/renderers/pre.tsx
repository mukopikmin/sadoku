import { Box, Button, CodeBlock as ChakraCodeBlock } from "@chakra-ui/react";
import { Children, isValidElement } from "react";
import type React from "react";
import { Tooltip } from "../../components/ui/tooltip";
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

const getMermaidCodeText = (
  children: React.ReactNode,
): string | undefined => {
  const childElements = Children.toArray(children);
  if (childElements.length !== 1) return undefined;
  const child = childElements[0];
  if (
    !isValidElement<{ children?: React.ReactNode; className?: string }>(child)
  ) {
    return undefined;
  }
  if (!child.props.className?.match(/\blanguage-mermaid\b/)) return undefined;
  return String(child.props.children).replace(/\n$/, "");
};

const renderMermaidPre = (source: string) => (
  <Box className="mermaid-container" py="2">
    <Box position="relative">
      <pre className="mermaid">{source}</pre>
      <Tooltip content="Zoom Mermaid diagram">
        <Button
          aria-label="Zoom Mermaid diagram"
          bg="canvas"
          className="mermaid-zoom-button"
          color="fg"
          position="absolute"
          right="2"
          size="xs"
          top="2"
          type="button"
          variant="outline"
        >
          Zoom
        </Button>
      </Tooltip>
    </Box>
  </Box>
);

export const renderMarkdownPre = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => {
  const mermaidCode = getMermaidCodeText(children);
  if (mermaidCode !== undefined) return renderMermaidPre(mermaidCode);

  return (
    <Box py="2">
      <ChakraCodeBlock.Root
        code={getCodeBlockText(children)}
        language={getCodeBlockLanguage(children)}
        borderColor="border.muted"
        borderRadius="sm"
        bg="canvas.subtle"
        color="code.fg"
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
};

export const MarkdownPre = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"pre">) => renderMarkdownPre(props, children);
