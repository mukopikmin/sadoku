import { Box, HStack, IconButton, Separator } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import ReactMarkdown from "react-markdown";
import { Tooltip } from "../ui/tooltip";
import {
  sharedMarkdownComponents,
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";
import { useExpandableSource } from "../../hooks/useExpandableSource";

export type CommentSourceMarkdownProps = {
  children: string;
};

export const CommentSourceMarkdown = ({
  children,
}: CommentSourceMarkdownProps) => {
  const source = useExpandableSource(children);
  const { contentRef, state } = source;
  const isExpanded = state.status === "expanded";
  const isOverflowing =
    isExpanded || (state.status === "collapsed" && state.canExpand);
  const contentId = useId();
  const toggleLabel = isExpanded ? "Collapse source" : "Show full source";

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
              onClick={source.toggle}
              size="xs"
              variant="ghost"
            >
              <Box
                rotate={isExpanded ? "-90deg" : "90deg"}
                transition="transform 120ms ease"
              >
                <ChevronRight aria-hidden="true" />
              </Box>
            </IconButton>
          </Tooltip>
          <Separator borderColor="border.muted" flex="1" />
        </HStack>
      )}
    </>
  );
};
