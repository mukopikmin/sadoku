import { Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../markdown/markdownRenderers";
import { initializeMermaid } from "../markdown/mermaid";

type Props = {
  children: string;
};

export const PullRequestDescription = ({ children }: Props) => {
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
      className="markdown-preview comment-body-markdown"
      mt="2"
      mb="6"
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
