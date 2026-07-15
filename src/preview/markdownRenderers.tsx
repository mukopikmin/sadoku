import { Box, List, Separator, Text } from "@chakra-ui/react";
import { createContext, useContext } from "react";
import type React from "react";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

export const sharedMarkdownRehypePlugins = [rehypeHighlight];
export const sharedMarkdownRemarkPlugins = [remarkGfm];

export type MarkdownElementProps = {
  children?: React.ReactNode;
  className?: string;
};

export const MarkdownListDepthContext = createContext(0);
const CodeBlockContext = createContext(false);
export const markdownListIndentEm = 2.5;

export const mergeClassNames = (
  ...classNames: Array<string | undefined>
): string | undefined => {
  const merged = classNames.filter(Boolean).join(" ");
  return merged === "" ? undefined : merged;
};

const headingSizes = {
  h1: "2rem",
  h2: "1.5rem",
  h3: "1.25rem",
  h4: "1rem",
  h5: "0.875rem",
  h6: "0.85rem",
} as const;

export const renderMarkdownHeading = (
  tagName: keyof typeof headingSizes,
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
    mt="6"
    mb="4"
    pb={tagName === "h1" || tagName === "h2" ? "0.3em" : "0"}
    {...elementProps}
  >
    {children}
  </Box>
);

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

export const renderMarkdownHorizontalRule = (
  elementProps: Omit<MarkdownElementProps, "children">,
) => (
  <Box mt="6" mb="6">
    <Separator
      as="hr"
      borderColor="border.muted"
      m="0"
      {...elementProps}
    />
  </Box>
);

export const renderMarkdownParagraph = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Text as="p" mt="0" mb="4" {...elementProps}>
    {children}
  </Text>
);

export const renderMarkdownPre = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box
    as="pre"
    overflow="auto"
    borderWidth="1px"
    borderColor="border.muted"
    borderRadius="6px"
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

export const sharedMarkdownComponents: Components = {
  a({ children, className, node: _node, ...props }) {
    const isHeadingAnchor = className?.split(/\s+/).includes(
      "heading-anchor",
    ) ?? false;
    return (
      <Box
        as="a"
        className={className}
        color={isHeadingAnchor ? "inherit" : "link"}
        textDecoration="none"
        _hover={isHeadingAnchor ? undefined : { textDecoration: "underline" }}
        {...props}
      >
        {children}
      </Box>
    );
  },
  blockquote({ children, node: _node, ...props }) {
    return renderMarkdownBlockquote(props, children);
  },
  code({ children, className, node: _node, ...props }) {
    const isCodeBlock = useContext(CodeBlockContext);
    return (
      <Box
        as="code"
        className={className}
        borderRadius={isCodeBlock ? "0" : "6px"}
        px={isCodeBlock ? "0" : "0.4em"}
        py={isCodeBlock ? "0" : "0.2em"}
        bg={isCodeBlock ? "transparent" : "code.bg"}
        color={isCodeBlock ? "code.fg" : "fg"}
        fontFamily="mono"
        fontSize={isCodeBlock ? "0.85rem" : "0.85em"}
        {...props}
      >
        {children}
      </Box>
    );
  },
  h1({ children, node: _node, ...props }) {
    return renderMarkdownHeading("h1", props, children);
  },
  h2({ children, node: _node, ...props }) {
    return renderMarkdownHeading("h2", props, children);
  },
  h3({ children, node: _node, ...props }) {
    return renderMarkdownHeading("h3", props, children);
  },
  h4({ children, node: _node, ...props }) {
    return renderMarkdownHeading("h4", props, children);
  },
  h5({ children, node: _node, ...props }) {
    return renderMarkdownHeading("h5", props, children);
  },
  h6({ children, node: _node, ...props }) {
    return renderMarkdownHeading("h6", props, children);
  },
  hr({ node: _node, ...props }) {
    return renderMarkdownHorizontalRule(props);
  },
  img({ node: _node, ...props }) {
    return <Box as="img" maxW="100%" h="auto" {...props} />;
  },
  li({ children, node: _node, ...props }) {
    return <List.Item {...props}>{children}</List.Item>;
  },
  ol({ children, className, node: _node, ...props }) {
    const listDepth = useContext(MarkdownListDepthContext);
    const isNested = listDepth > 0;
    return (
      <MarkdownListDepthContext.Provider value={listDepth + 1}>
        <List.Root
          as="ol"
          className={mergeClassNames("comment-markdown-list", className)}
          listStylePosition="outside"
          mt={isNested ? "0.25em" : "2"}
          mb={isNested ? "0" : "4"}
          ps={`${markdownListIndentEm}em`}
          {...props}
        >
          {children}
        </List.Root>
      </MarkdownListDepthContext.Provider>
    );
  },
  p({ children, node: _node, ...props }) {
    return renderMarkdownParagraph(props, children);
  },
  pre({ children, node: _node, ...props }) {
    return renderMarkdownPre(props, children);
  },
  ul({ children, className, node: _node, ...props }) {
    const listDepth = useContext(MarkdownListDepthContext);
    const isNested = listDepth > 0;
    return (
      <MarkdownListDepthContext.Provider value={listDepth + 1}>
        <List.Root
          as="ul"
          className={mergeClassNames("comment-markdown-list", className)}
          listStylePosition="outside"
          mt={isNested ? "0.25em" : "2"}
          mb={isNested ? "0" : "4"}
          ps={`${markdownListIndentEm}em`}
          {...props}
        >
          {children}
        </List.Root>
      </MarkdownListDepthContext.Provider>
    );
  },
};
