import { Box, DataList } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CommentActions } from "../../api/commentActions";
import { CommentableBlock } from "../../markdown/commentable/CommentableBlock";
import { CommentableMarkdown } from "../../markdown/commentable/CommentableMarkdown";
import { getCommentableBlockProps } from "../../markdown/commentable/commentableMarkdownComponents";
import {
  type CommentRange,
  deriveRangeHighlights,
  getSingleLineCommentHighlights,
  groupCommentsByAnchorLine,
} from "../../markdown/commentable/commentRanges";
import {
  CommentRenderingContext,
  type CommentRenderingContextValue,
} from "../../markdown/commentable/commentRendering";
import { useCommentableBlockLayout } from "../../markdown/commentable/useCommentableBlockLayout";
import { useCommentSelection } from "../../markdown/commentable/useCommentSelection";
import { initializeMermaid } from "../../markdown/mermaid";
import { useHeadingHashNavigation } from "../../markdown/useHeadingHashNavigation";
import type { ActiveComment } from "../../models/comment";
import { extractAgentFrontMatter } from "./frontMatter";
import { RawMarkdownDialog } from "./RawMarkdownDialog";

export type MarkdownPreviewProps = {
  actions: CommentActions;
  comments: ActiveComment[];
  documentPath?: string;
  markdown: string;
  showHtmlComments: boolean;
  theme: "dark" | "default";
};

export const MarkdownPreview = ({
  actions,
  comments,
  documentPath,
  markdown,
  showHtmlComments,
  theme,
}: MarkdownPreviewProps) => {
  const frontMatter = useMemo(
    () => extractAgentFrontMatter(markdown, documentPath),
    [documentPath, markdown],
  );
  const renderedMarkdown = frontMatter?.bodyMarkdown ?? markdown;
  const previewRef = useRef<HTMLDivElement>(null);
  const [rawMarkdownRange, setRawMarkdownRange] = useState<CommentRange>();
  const {
    activeCommentLine,
    activeRange,
    closeCommentForm,
    openCommentForm,
    selectCommentRange,
    selectedRange,
  } = useCommentSelection();
  const rangeHighlights = useMemo(
    () => deriveRangeHighlights(comments, selectedRange),
    [comments, selectedRange],
  );
  const { commentableLines, rangeHighlightLayouts } = useCommentableBlockLayout(
    previewRef,
    rangeHighlights,
  );
  const commentsByLine = useMemo(
    () => groupCommentsByAnchorLine(comments, commentableLines),
    [commentableLines, comments],
  );
  const commentHighlightsByLine = useMemo(
    () => getSingleLineCommentHighlights(comments),
    [comments],
  );

  useHeadingHashNavigation(previewRef, markdown);

  useEffect(() => {
    void initializeMermaid({ theme });
  }, [
    activeCommentLine,
    comments,
    markdown,
    selectedRange,
    showHtmlComments,
    theme,
  ]);

  const commentRenderingContext = useMemo<CommentRenderingContextValue>(() => ({
    actions,
    activeCommentLine,
    activeRange,
    commentsByLine,
    commentHighlightsByLine,
    markdown,
    onCloseCommentForm: closeCommentForm,
    onOpenCommentForm: openCommentForm,
    onOpenRawMarkdown: setRawMarkdownRange,
    onSelectCommentRange: selectCommentRange,
    selectedRange,
  }), [
    actions,
    activeCommentLine,
    activeRange,
    closeCommentForm,
    commentHighlightsByLine,
    commentsByLine,
    markdown,
    openCommentForm,
    selectCommentRange,
    selectedRange,
  ]);

  return (
    <CommentRenderingContext.Provider value={commentRenderingContext}>
      <RawMarkdownDialog
        markdown={markdown}
        onOpenChange={(open) => {
          if (!open) setRawMarkdownRange(undefined);
        }}
        open={rawMarkdownRange !== undefined}
        range={rawMarkdownRange}
      />
      <Box className="markdown-preview" ref={previewRef}>
        <Box aria-hidden="true" className="markdown-range-highlights">
          {rangeHighlightLayouts.map((layout) => (
            <Box
              className={`markdown-range-highlight markdown-range-highlight-${layout.kind}`}
              data-end-line={layout.endLine}
              data-start-line={layout.startLine}
              height={`${Math.max(0, layout.bottom - layout.top - 2)}px`}
              key={`${layout.kind}-${layout.startLine}-${layout.endLine}`}
              top={`${layout.top + 1}px`}
            />
          ))}
        </Box>
        {frontMatter && (
          <DataList.Root
            orientation={{ base: "vertical", md: "horizontal" }}
            gap="0"
          >
            {frontMatter.items.map((item) => (
              <CommentableBlock
                {...getCommentableBlockProps(commentRenderingContext, {
                  startLine: item.startLine,
                  endLine: item.endLine,
                })}
                key={`${item.key}-${item.startLine}`}
              >
                <DataList.Item
                  alignItems="start"
                  gap={{ base: "1", md: "2" }}
                  py="1"
                >
                  <DataList.ItemLabel minW={{ md: "auto" }}>
                    {item.key}
                  </DataList.ItemLabel>
                  <DataList.ItemValue
                    minW="0"
                    overflowWrap="anywhere"
                    whiteSpace="pre-wrap"
                  >
                    {item.value}
                  </DataList.ItemValue>
                </DataList.Item>
              </CommentableBlock>
            ))}
          </DataList.Root>
        )}
        <CommentableMarkdown showHtmlComments={showHtmlComments}>
          {renderedMarkdown}
        </CommentableMarkdown>
      </Box>
    </CommentRenderingContext.Provider>
  );
};
