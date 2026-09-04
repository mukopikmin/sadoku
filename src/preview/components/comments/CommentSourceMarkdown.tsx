import { Box, Button } from "@chakra-ui/react";
import { useId, useState } from "react";
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
) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  return (
    <>
      <Box
        className="comment-source-markdown"
        id={contentId}
        maxH={isExpanded ? undefined : "160px"}
        overflowY={isExpanded ? undefined : "auto"}
      >
        <ReactMarkdown
          components={sharedMarkdownComponents}
          rehypePlugins={sharedMarkdownRehypePlugins}
          remarkPlugins={sharedMarkdownRemarkPlugins}
        >
          {children}
        </ReactMarkdown>
      </Box>
      <Button
        aria-controls={contentId}
        aria-expanded={isExpanded}
        mt="1"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        size="xs"
        variant="outline"
      >
        {isExpanded ? "Show less" : "Show more"}
      </Button>
    </>
  );
};
