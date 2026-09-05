import { Box, Button, HStack, Separator } from "@chakra-ui/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
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
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || isExpanded) return;

    const updateOverflow = () => {
      setIsOverflowing(content.scrollHeight > content.clientHeight);
    };
    updateOverflow();

    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(updateOverflow);
    observer?.observe(content);
    window.addEventListener("resize", updateOverflow);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [children, isExpanded]);

  return (
    <>
      <Box
        className="comment-source-markdown"
        id={contentId}
        maxH={isExpanded ? undefined : "160px"}
        overflowY={isExpanded ? "visible" : "auto"}
        ref={contentRef}
      >
        <ReactMarkdown
          components={sharedMarkdownComponents}
          rehypePlugins={sharedMarkdownRehypePlugins}
          remarkPlugins={sharedMarkdownRemarkPlugins}
        >
          {children}
        </ReactMarkdown>
      </Box>
      {isOverflowing && (
        <HStack gap="2">
          <Separator borderColor="border.muted" flex="1" />
          <Button
            aria-controls={contentId}
            aria-expanded={isExpanded}
            color="fg.muted"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            size="xs"
            variant="ghost"
          >
            {isExpanded ? "Collapse source \u2191" : "Show full source \u2193"}
          </Button>
          <Separator borderColor="border.muted" flex="1" />
        </HStack>
      )}
    </>
  );
};
