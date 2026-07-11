import { Box, List } from "@chakra-ui/react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

export type CommentMarkdownProps = {
  children: string;
};

const components: Components = {
  blockquote({ children, node: _node, ...props }) {
    return (
      <Box
        as="blockquote"
        borderColor="border.default"
        borderLeftWidth="4px"
        color="fg.muted"
        pl="4"
        {...props}
      >
        {children}
      </Box>
    );
  },
  ol({ children, node: _node, ...props }) {
    return (
      <List.Root
        as="ol"
        listStylePosition="outside"
        ps="2.5em"
        {...props}
      >
        {children}
      </List.Root>
    );
  },
  ul({ children, node: _node, ...props }) {
    return (
      <List.Root
        as="ul"
        listStylePosition="outside"
        ps="2.5em"
        {...props}
      >
        {children}
      </List.Root>
    );
  },
};

export const CommentMarkdown = ({ children }: CommentMarkdownProps) => (
  <Box className="comment-markdown-body comment-body-markdown">
    <ReactMarkdown
      components={components}
      rehypePlugins={[rehypeHighlight]}
      remarkPlugins={[remarkGfm]}
    >
      {children}
    </ReactMarkdown>
  </Box>
);
