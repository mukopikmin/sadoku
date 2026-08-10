import { Box } from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";

export type CommentSourceMarkdownProps = {
  children: string;
};

export const CommentSourceMarkdown = (
  { children }: CommentSourceMarkdownProps,
) => (
  <Box
    className="comment-source-markdown"
    maxH="160px"
    overflowY="auto"
  >
    <ReactMarkdown
      components={sharedMarkdownComponents}
      rehypePlugins={sharedMarkdownRehypePlugins}
      remarkPlugins={sharedMarkdownRemarkPlugins}
    >
      {children}
    </ReactMarkdown>
  </Box>
);
