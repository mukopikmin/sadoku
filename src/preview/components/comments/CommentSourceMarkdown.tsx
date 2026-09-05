import { Box, HStack, IconButton, Separator } from "@chakra-ui/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronRightIcon } from "../ui/ChevronRightIcon";
import { Tooltip } from "../ui/tooltip";
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
  const toggleLabel = isExpanded ? "Collapse source" : "Show full source";

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
          <Tooltip content={toggleLabel}>
            <IconButton
              aria-controls={contentId}
              aria-expanded={isExpanded}
              aria-label={toggleLabel}
              color="fg.muted"
              onClick={() => setIsExpanded((expanded) => !expanded)}
              size="xs"
              variant="ghost"
            >
              <Box
                rotate={isExpanded ? "-90deg" : "90deg"}
                transition="transform 120ms ease"
              >
                <ChevronRightIcon />
              </Box>
            </IconButton>
          </Tooltip>
          <Separator borderColor="border.muted" flex="1" />
        </HStack>
      )}
    </>
  );
};
