import { Box } from "@chakra-ui/react";
import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";
import { useMermaidRendering } from "../../markdown/useMermaidRendering";
import { remarkSuggestions } from "../../markdown/remarkSuggestions";
import { remarkCommentBreaks } from "../../markdown/remarkCommentBreaks";

export type CommentMarkdownProps = {
  children: string;
  sourceText?: string;
};

export const CommentMarkdown = ({
  children,
  sourceText,
}: CommentMarkdownProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useMermaidRendering(containerRef, [children]);

  return (
    <Box
      className="comment-markdown-body comment-body-markdown"
      fontSize="comment"
      ref={containerRef}
    >
      <ReactMarkdown
        components={sharedMarkdownComponents}
        rehypePlugins={sharedMarkdownRehypePlugins}
        remarkPlugins={[
          ...sharedMarkdownRemarkPlugins,
          remarkCommentBreaks,
          [remarkSuggestions, { sourceText }],
        ]}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
};
