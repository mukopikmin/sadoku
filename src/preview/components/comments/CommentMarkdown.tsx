import { Box, Code, Text } from "@chakra-ui/react";
import { isValidElement, useEffect, useMemo, useRef } from "react";
import type React from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";
import { initializeMermaid } from "../../markdown/mermaid";

const getSuggestion = (children: React.ReactNode): string | undefined => {
  const child = Array.isArray(children) ? children[0] : children;
  if (
    !isValidElement<{ children?: React.ReactNode; className?: string }>(child)
  ) {
    return undefined;
  }
  if (!child.props.className?.split(/\s+/).includes("language-suggestion")) {
    return undefined;
  }
  return String(child.props.children ?? "").replace(/\n$/, "");
};

const CommentSuggestion = ({ children }: { children: React.ReactNode }) => {
  const suggestion = getSuggestion(children);
  if (suggestion === undefined) {
    const MarkdownPre = sharedMarkdownComponents.pre!;
    return <MarkdownPre>{children}</MarkdownPre>;
  }

  return (
    <Box
      bg="syntax.addition.bg"
      borderColor="border.muted"
      borderRadius="sm"
      borderWidth="1px"
      my="2"
      overflow="hidden"
    >
      <Text
        borderBottomColor="border.muted"
        borderBottomWidth="1px"
        color="syntax.addition.fg"
        fontSize="xs"
        fontWeight="semibold"
        px="3"
        py="1"
      >
        Suggested change
      </Text>
      <Code
        as="pre"
        bg="transparent"
        color="syntax.addition.fg"
        display="block"
        fontFamily="mono"
        fontSize="sm"
        m="0"
        overflowX="auto"
        p="3"
        whiteSpace="pre"
      >
        {suggestion}
      </Code>
    </Box>
  );
};

export type CommentMarkdownProps = {
  children: string;
};

export const CommentMarkdown = ({ children }: CommentMarkdownProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const components = useMemo<Components>(() => ({
    ...sharedMarkdownComponents,
    pre: CommentSuggestion,
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    void initializeMermaid({
      root: containerRef.current,
      theme: document.documentElement.dataset.theme === "dark"
        ? "dark"
        : "default",
    });
  }, [children]);

  return (
    <Box
      className="comment-markdown-body comment-body-markdown"
      ref={containerRef}
    >
      <ReactMarkdown
        components={components}
        rehypePlugins={sharedMarkdownRehypePlugins}
        remarkPlugins={sharedMarkdownRemarkPlugins}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
};
