import { useMemo, useRef, useState } from "react";
import type { MarkdownPreviewProps } from "./MarkdownPreview";
import {
  type CommentRange,
  deriveRangeHighlights,
  getSingleLineCommentHighlights,
  groupCommentsByAnchorLine,
} from "../../markdown/commentable/commentRanges";
import type { CommentRenderingContextValue } from "../../markdown/commentable/commentRendering";
import { useCommentableBlockLayout } from "../../markdown/commentable/useCommentableBlockLayout";
import { useCommentSelection } from "../../markdown/commentable/useCommentSelection";
import { useMermaidRendering } from "../../markdown/useMermaidRendering";
import { useHeadingHashNavigation } from "../../markdown/useHeadingHashNavigation";
import { extractAgentFrontMatter } from "./frontMatter";
import { groupDeletedComments } from "../../markdown/commentable/deletedComments";

export const useMarkdownPreview = ({
  actions,
  comments,
  documentPath,
  markdown,
  previousMarkdown,
  showHtmlComments,
  theme,
}: MarkdownPreviewProps) => {
  const activeComments = useMemo(
    () => comments.filter((comment) => comment.state === "active"),
    [comments],
  );
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
  const [raw, setRaw] = useState<
    { status: "closed" } | { status: "open"; range: CommentRange }
  >({ status: "closed" });
  const [drafts] = useState(() => new Map<number, string>());
  const selection = useCommentSelection();
  const { closeCommentForm, openCommentForm, selectCommentRange } = selection;
  const selectedRange =
    selection.state.status === "none" ? undefined : selection.state.range;
  const activeRange =
    selection.state.status === "composing" ? selection.state.range : undefined;
  const activeCommentLine = activeRange?.endLine;
  const rangeHighlights = useMemo(
    () => deriveRangeHighlights(activeComments, selectedRange),
    [activeComments, selectedRange],
  );
  const { commentableLines, deletedRanges, rangeHighlightLayouts } =
    useCommentableBlockLayout(previewRef, rangeHighlights);
  const commentsByLine = useMemo(
    () => groupCommentsByAnchorLine(activeComments, commentableLines),
    [commentableLines, activeComments],
  );
  const commentHighlightsByLine = useMemo(
    () => getSingleLineCommentHighlights(activeComments),
    [activeComments],
  );
  const deletedCommentsByLine = useMemo(
    () =>
      groupDeletedComments(
        comments.filter((comment) => comment.state === "stale"),
        previousMarkdown ?? "",
        deletedRanges,
      ),
    [comments, previousMarkdown, deletedRanges],
  );

  useHeadingHashNavigation(previewRef, markdown);

  useMermaidRendering(
    undefined,
    [
      activeCommentLine,
      comments,
      markdown,
      previousMarkdown,
      selectedRange,
      showHtmlComments,
      theme,
    ],
    theme,
  );

  const commentRenderingContext = useMemo<CommentRenderingContextValue>(
    () => ({
      actions,
      activeCommentLine,
      activeRange,
      commentsByLine,
      commentHighlightsByLine,
      drafts,
      markdown,
      rangeHighlights,
      onCloseCommentForm: closeCommentForm,
      onOpenCommentForm: openCommentForm,
      onOpenRawMarkdown: (range) => setRaw({ status: "open", range }),
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
      rangeHighlights,
      selectCommentRange,
      selectedRange,
    ],
  );

  return {
    frontMatter,
    previousFrontMatter,
    frontMatterChanged,
    renderedMarkdown,
    previewRef,
    rangeHighlightLayouts,
    commentRenderingContext,
    deletedCommentsByLine,
    raw,
    closeRaw: () => setRaw({ status: "closed" }),
  };
};
