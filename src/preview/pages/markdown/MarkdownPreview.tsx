import { Box, DataList } from "@chakra-ui/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { HighlightOverlay } from "../../markdown/HighlightOverlay";
import { useHeadingHashNavigation } from "../../markdown/useHeadingHashNavigation";
import type { ActiveComment } from "../../models/comment";
import { extractAgentFrontMatter } from "./frontMatter";
import { RawMarkdownDialog } from "./RawMarkdownDialog";
import { DocumentDiffBlock } from "../../markdown/DocumentDiffBlock";
import { ReadOnlyMarkdownPreview } from "./ReadOnlyMarkdownPreview";

export type MarkdownPreviewProps = {
  actions: CommentActions;
  comments: ActiveComment[];
  documentPath?: string;
  markdown: string;
  previousMarkdown?: string;
  showHtmlComments: boolean;
  theme: "dark" | "default";
};

export const MarkdownPreview = ({
  actions,
  comments,
  documentPath,
  markdown,
  previousMarkdown,
  showHtmlComments,
  theme,
}: MarkdownPreviewProps) => {
  const frontMatter = useMemo(
    () => extractAgentFrontMatter(markdown, documentPath),
    [documentPath, markdown],
  );
  const previousFrontMatter = useMemo(
    () =>
      previousMarkdown === undefined
        ? undefined
        : extractAgentFrontMatter(previousMarkdown, documentPath),
    [documentPath, previousMarkdown],
  );
  const frontMatterChanged =
    previousMarkdown !== undefined &&
    JSON.stringify(frontMatter?.items.map(({ key, value }) => [key, value])) !==
      JSON.stringify(
        previousFrontMatter?.items.map(({ key, value }) => [key, value]),
      );
  const renderedMarkdown = frontMatter?.bodyMarkdown ?? markdown;
  const previewRef = useRef<HTMLDivElement>(null);
  const [rawMarkdownRange, setRawMarkdownRange] = useState<CommentRange>();
  const [drafts] = useState(() => new Map<number, string>());
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
    previousMarkdown,
    selectedRange,
    showHtmlComments,
    theme,
  ]);

  const commentRenderingContext = useMemo<CommentRenderingContextValue>(
    () => ({
      actions,
      activeCommentLine,
      activeRange,
      commentsByLine,
      commentHighlightsByLine,
      drafts,
      markdown,
      onCloseCommentForm: closeCommentForm,
      onOpenCommentForm: openCommentForm,
      onOpenRawMarkdown: setRawMarkdownRange,
      onSelectCommentRange: selectCommentRange,
      selectedRange,
    }),
    [
      actions,
      activeCommentLine,
      activeRange,
      closeCommentForm,
      commentHighlightsByLine,
      commentsByLine,
      drafts,
      markdown,
      openCommentForm,
      selectCommentRange,
      selectedRange,
    ],
  );

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
      <Box
        className="markdown-preview"
        data-document-diff={previousMarkdown !== undefined ? "" : undefined}
        ref={previewRef}
      >
        <HighlightOverlay layouts={rangeHighlightLayouts} />
        {frontMatterChanged && previousFrontMatter && (
          <DocumentDiffBlock kind="deletion">
            <ReadOnlyMarkdownPreview
              documentPath={documentPath}
              markdown={previousMarkdown!
                .split(/\r?\n/)
                .slice(0, previousFrontMatter.endLine)
                .join("\n")}
              showHtmlComments={showHtmlComments}
              theme={theme}
            />
          </DocumentDiffBlock>
        )}
        {frontMatter && (
          <FrontMatterDiff changed={frontMatterChanged}>
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
          </FrontMatterDiff>
        )}
        <CommentableMarkdown
          documentPath={documentPath}
          previousMarkdown={
            previousFrontMatter?.bodyMarkdown ?? previousMarkdown
          }
          showHtmlComments={showHtmlComments}
          theme={theme}
        >
          {renderedMarkdown}
        </CommentableMarkdown>
      </Box>
    </CommentRenderingContext.Provider>
  );
};

const FrontMatterDiff = ({
  changed,
  children,
}: {
  changed: boolean;
  children: ReactNode;
}) =>
  changed ? (
    <DocumentDiffBlock kind="addition">{children}</DocumentDiffBlock>
  ) : (
    children
  );
