import { Box } from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";

export type CommentMarkdownProps = {
  children: string;
};

export const CommentMarkdown = ({ children }: CommentMarkdownProps) => (
  <Box className="comment-markdown-body comment-body-markdown">
    <ReactMarkdown
      components={sharedMarkdownComponents}
      rehypePlugins={sharedMarkdownRehypePlugins}
      remarkPlugins={sharedMarkdownRemarkPlugins}
    >
      {children}
    </ReactMarkdown>
  </Box>
);
