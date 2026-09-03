import { Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";
import { initializeMermaid } from "../../markdown/mermaid";

export type CommentSourceMarkdownProps = {
  children: string;
};

export const CommentSourceMarkdown = (
  { children }: CommentSourceMarkdownProps,
) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
      className="comment-source-markdown"
      maxH="160px"
      overflowY="auto"
      ref={containerRef}
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
};
