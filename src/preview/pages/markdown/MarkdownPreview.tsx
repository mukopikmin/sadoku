import { Box } from "@chakra-ui/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import type { CommentActions } from "../../api/commentActions";
import { createCommentableMarkdownComponents } from "./commentableMarkdownComponents";
import type { ActiveComment } from "../../models/comment";
import {
  type CommentRange,
  type CommentRangeSelectionOptions,
  CommentRenderingContext,
  isLineInRange,
} from "./commentRendering";
import {
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "../../markdown/markdownRenderers";
import { initializeMermaid } from "../../markdown/mermaid";
import {
  useCommentActions,
  useCommentsQuery,
} from "../../hooks/usePreviewData";

export type MarkdownPreviewProps = {
  actions: CommentActions;
  comments: ActiveComment[];
  markdown: string;
  theme: "dark" | "default";
};

type RangeHighlight = CommentRange & {
  kind: "comment" | "selection";
};

type RangeHighlightLayout = RangeHighlight & {
  bottom: number;
  top: number;
};

const commentableBlockSelector =
  ":scope > .commentable-block, :scope > .comment-markdown-list .commentable-block";

const getCommentAnchorLine = (
  comment: ActiveComment,
  commentableLines: readonly number[],
): number => {
  const linesInRange = commentableLines.filter((line) =>
    isLineInRange(line, comment)
  );
  if (linesInRange.length > 0) return linesInRange.at(-1)!;
  if (commentableLines.length === 0) return comment.endLine;
  return commentableLines.slice(1).reduce((closest, line) => {
    const distance = line < comment.startLine
      ? comment.startLine - line
      : line - comment.endLine;
    const closestDistance = closest < comment.startLine
      ? comment.startLine - closest
      : closest - comment.endLine;
    return distance < closestDistance ? line : closest;
  }, commentableLines[0]);
};

const mergeRanges = (ranges: CommentRange[]): CommentRange[] => {
  const sorted = [...ranges].sort((a, b) =>
    a.startLine - b.startLine || a.endLine - b.endLine
  );
  const merged: CommentRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.startLine > previous.endLine + 1) {
      merged.push({ ...range });
      continue;
    }
    previous.endLine = Math.max(previous.endLine, range.endLine);
  }
  return merged;
};

const subtractRange = (
  ranges: CommentRange[],
  excluded?: CommentRange,
): CommentRange[] => {
  if (!excluded) return ranges;
  return ranges.flatMap((range) => {
    if (
      excluded.endLine < range.startLine ||
      excluded.startLine > range.endLine
    ) return [range];

    const remaining: CommentRange[] = [];
    if (excluded.startLine > range.startLine) {
      remaining.push({
        startLine: range.startLine,
        endLine: excluded.startLine - 1,
      });
    }
    if (excluded.endLine < range.endLine) {
      remaining.push({
        startLine: excluded.endLine + 1,
        endLine: range.endLine,
      });
    }
    return remaining;
  });
};

const isSelectedSingleLine = (
  line: number,
  range?: CommentRange,
): boolean =>
  range !== undefined && range.startLine === range.endLine &&
  isLineInRange(line, range);

export const MarkdownPreview = ({
  actions,
  comments,
  markdown,
  theme,
}: MarkdownPreviewProps) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [commentableLines, setCommentableLines] = useState<number[]>([]);
  const commentsByLine = useMemo(() => {
    const grouped = new Map<number, ActiveComment[]>();
    for (const comment of comments) {
      const anchorLine = getCommentAnchorLine(comment, commentableLines);
      grouped.set(anchorLine, [
        ...(grouped.get(anchorLine) ?? []),
        comment,
      ]);
    }
    return grouped;
  }, [commentableLines, comments]);
  const continuousCommentRanges = useMemo(() =>
    mergeRanges(
      comments.filter((comment) => comment.startLine < comment.endLine).map(
        ({ startLine, endLine }) => ({ startLine, endLine }),
      ),
    ), [comments]);
  const commentHighlightsByLine = useMemo(() => {
    const highlighted = new Set<number>();
    for (const comment of comments) {
      if (comment.startLine === comment.endLine) {
        highlighted.add(comment.startLine);
      }
    }
    return highlighted;
  }, [comments]);

  const [activeCommentLine, setActiveCommentLine] = useState<number>();
  const [activeRange, setActiveRange] = useState<CommentRange>();
  const [lineSelectionAnchor, setLineSelectionAnchor] = useState<number>();
  const [selectedRange, setSelectedRange] = useState<CommentRange>();
  const continuousSelectedRange = selectedRange &&
      selectedRange.startLine < selectedRange.endLine
    ? selectedRange
    : undefined;
  const rangeHighlights = useMemo<RangeHighlight[]>(() => [
    ...subtractRange(continuousCommentRanges, continuousSelectedRange).map(
      (range) => ({ ...range, kind: "comment" as const }),
    ),
    ...(continuousSelectedRange
      ? [{ ...continuousSelectedRange, kind: "selection" as const }]
      : []),
  ], [continuousCommentRanges, continuousSelectedRange]);
  const [rangeHighlightLayouts, setRangeHighlightLayouts] = useState<
    RangeHighlightLayout[]
  >([]);

  const updateRangeHighlightLayouts = useCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const previewRect = preview.getBoundingClientRect();
    const blocks = [...preview.querySelectorAll<HTMLElement>(
      commentableBlockSelector,
    )];
    const layouts = rangeHighlights.flatMap((range) => {
      const contents = blocks.filter((block) => {
        const startLine = Number(block.dataset.sourceLine);
        const endLine = Number(block.dataset.sourceEndLine ?? startLine);
        return endLine >= range.startLine && startLine <= range.endLine;
      }).map((block) =>
        block.querySelector<HTMLElement>(":scope > .commentable-content")
      ).filter((content): content is HTMLElement => content !== null);
      if (contents.length === 0) return [];
      const rects = contents.map((content) => {
        const element = content.querySelector<HTMLElement>(
          ":scope > .comment-markdown-body > :first-child",
        );
        const rect = (element ?? content).getBoundingClientRect();
        const style = element ? getComputedStyle(element) : undefined;
        return {
          top: rect.top - (Number.parseFloat(style?.marginTop ?? "0") || 0),
          bottom: rect.bottom +
            (Number.parseFloat(style?.marginBottom ?? "0") || 0),
        };
      });
      return [{
        ...range,
        top: Math.min(...rects.map((rect) => rect.top)) - previewRect.top,
        bottom: Math.max(...rects.map((rect) => rect.bottom)) - previewRect.top,
      }];
    });
    setRangeHighlightLayouts((current) =>
      JSON.stringify(current) === JSON.stringify(layouts) ? current : layouts
    );
  }, [rangeHighlights]);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const lines = [...preview.querySelectorAll<HTMLElement>(
      commentableBlockSelector,
    )].map((block) => Number(block.dataset.sourceLine)).filter(Number.isFinite)
      .sort((left, right) => left - right);
    setCommentableLines((current) =>
      current.length === lines.length &&
        current.every((line, index) => line === lines[index])
        ? current
        : lines
    );
  }, [markdown]);

  useLayoutEffect(() => {
    updateRangeHighlightLayouts();
    const preview = previewRef.current;
    if (!preview) return;
    const handleResize = () => updateRangeHighlightLayouts();
    globalThis.addEventListener("resize", handleResize);
    const observer = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(handleResize);
    observer?.observe(preview);
    return () => {
      observer?.disconnect();
      globalThis.removeEventListener("resize", handleResize);
    };
  }, [updateRangeHighlightLayouts, activeCommentLine, markdown]);

  useEffect(() => {
    void initializeMermaid({ theme });
  }, [activeCommentLine, comments, markdown, selectedRange, theme]);

  const handleSelectCommentRange = (
    clickedRange: CommentRange,
    { extend }: CommentRangeSelectionOptions,
  ) => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelectedRange((current) => {
      if (
        current && current.startLine === clickedRange.startLine &&
        current.endLine === clickedRange.endLine
      ) {
        setLineSelectionAnchor(undefined);
        return undefined;
      }
      const range = !extend || lineSelectionAnchor === undefined
        ? clickedRange
        : {
          endLine: Math.max(lineSelectionAnchor, clickedRange.endLine),
          startLine: Math.min(lineSelectionAnchor, clickedRange.startLine),
        };
      if (!extend || lineSelectionAnchor === undefined) {
        setLineSelectionAnchor(clickedRange.startLine);
      }
      return range;
    });
  };

  const handleOpenCommentForm = () => {
    if (!selectedRange) return;
    setActiveCommentLine(selectedRange.endLine);
    setActiveRange(selectedRange);
  };

  const handleCloseCommentForm = () => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelectedRange(undefined);
    setLineSelectionAnchor(undefined);
  };

  const components = useMemo<Components>(
    createCommentableMarkdownComponents,
    [],
  );
  const commentRenderingContext = {
    actions,
    activeCommentLine,
    activeRange,
    commentsByLine,
    commentHighlightsByLine,
    onCloseCommentForm: handleCloseCommentForm,
    onOpenCommentForm: handleOpenCommentForm,
    onSelectCommentRange: handleSelectCommentRange,
    selectedRange,
  };

  return (
    <CommentRenderingContext.Provider value={commentRenderingContext}>
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
        <ReactMarkdown
          components={components}
          rehypePlugins={[
            rehypeSlug,
            [rehypeAutolinkHeadings, {
              behavior: "wrap",
              properties: { className: "heading-anchor" },
            }],
            ...sharedMarkdownRehypePlugins,
          ]}
          remarkPlugins={sharedMarkdownRemarkPlugins}
        >
          {markdown}
        </ReactMarkdown>
      </Box>
    </CommentRenderingContext.Provider>
  );
};

export const MarkdownPreviewPage = (
  { markdown, theme }: Pick<MarkdownPreviewProps, "markdown" | "theme">,
) => {
  const commentsQuery = useCommentsQuery();
  const actions = useCommentActions();
  if (!commentsQuery.data) return null;
  const activeComments = commentsQuery.data.comments.filter(
    (comment): comment is ActiveComment => comment.state === "active",
  );
  return (
    <MarkdownPreview
      actions={actions}
      comments={activeComments}
      markdown={markdown}
      theme={theme}
    />
  );
};
