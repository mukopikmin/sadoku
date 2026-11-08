import { Box } from "@chakra-ui/react";
import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../markdown/markdownRenderers";
import { useMermaidRendering } from "../markdown/useMermaidRendering";

type Props = {
  children: string;
};

export const PullRequestDescription = ({ children }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useMermaidRendering(containerRef, [children]);

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
