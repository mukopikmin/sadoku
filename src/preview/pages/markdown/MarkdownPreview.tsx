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
import type { PreviewComment } from "../../api/comments";
import {
  type CommentRange,
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
  comments: PreviewComment[];
  markdown: string;
};

type RangeHighlight = CommentRange & {
  kind: "comment" | "selection";
};

type RangeHighlightLayout = RangeHighlight & {
  bottom: number;
  top: number;
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
}: MarkdownPreviewProps) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const commentsByLine = useMemo(() => {
    const grouped = new Map<number, PreviewComment[]>();
    for (const comment of comments) {
      grouped.set(comment.endLine, [
        ...(grouped.get(comment.endLine) ?? []),
        comment,
      ]);
    }
    return grouped;
  }, [comments]);
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
      ":scope > .commentable-block, :scope > .comment-markdown-list .commentable-block",
    )];
    const layouts = rangeHighlights.flatMap((range) => {
      const contents = blocks.filter((block) => {
        const line = Number(block.dataset.sourceLine);
        return line >= range.startLine && line <= range.endLine;
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
    void initializeMermaid();
  });

  const handleSelectCommentLine = (line: number) => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelectedRange((current) => {
      if (current && isLineInRange(line, current)) {
        setLineSelectionAnchor(undefined);
        return undefined;
      }
      const range = lineSelectionAnchor === undefined
        ? { endLine: line, startLine: line }
        : {
          endLine: Math.max(lineSelectionAnchor, line),
          startLine: Math.min(lineSelectionAnchor, line),
        };
      setLineSelectionAnchor(lineSelectionAnchor ?? line);
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
    onSelectCommentLine: handleSelectCommentLine,
    selectedRange,
  };

  return (
    <CommentRenderingContext.Provider value={commentRenderingContext}>
      <div className="markdown-preview" ref={previewRef}>
        <div aria-hidden="true" className="markdown-range-highlights">
          {rangeHighlightLayouts.map((layout) => (
            <div
              className={`markdown-range-highlight markdown-range-highlight-${layout.kind}`}
              data-end-line={layout.endLine}
              data-start-line={layout.startLine}
              key={`${layout.kind}-${layout.startLine}-${layout.endLine}`}
              style={{
                height: `${Math.max(0, layout.bottom - layout.top - 2)}px`,
                top: `${layout.top + 1}px`,
              }}
            />
          ))}
        </div>
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
      </div>
    </CommentRenderingContext.Provider>
  );
};

export const MarkdownPreviewPage = ({ markdown }: { markdown: string }) => {
  const commentsQuery = useCommentsQuery();
  const actions = useCommentActions();
  if (!commentsQuery.data) return null;
  const activeComments = commentsQuery.data.comments.filter((comment) =>
    !comment.resolved && !comment.stale
  );
  return (
    <MarkdownPreview
      actions={actions}
      comments={activeComments}
      markdown={markdown}
    />
  );
};
