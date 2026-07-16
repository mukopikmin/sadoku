import { useEffect, useMemo, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import type { CommentThreadActions } from "./commentActions";
import { createCommentableMarkdownComponents } from "./commentableMarkdownComponents";
import {
  type CommentRange,
  CommentRenderingContext,
  isLineInRange,
} from "./commentRendering";
import type { PreviewComment } from "./comments";
import {
  sharedMarkdownRehypePlugins,
  sharedMarkdownRemarkPlugins,
} from "./markdownRenderers";
import { initializeMermaid } from "./mermaid";

export type MarkdownPreviewProps = CommentThreadActions & {
  comments: PreviewComment[];
  markdown: string;
  onCreateComment: (
    startLine: number,
    body: string,
    endLine: number,
  ) => Promise<void>;
};

export const MarkdownPreview = ({
  comments,
  markdown,
  onCreateComment,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
}: MarkdownPreviewProps) => {
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
  const commentHighlightsByLine = useMemo(() => {
    const highlighted = new Set<number>();
    for (const comment of comments) {
      for (let line = comment.startLine; line <= comment.endLine; line += 1) {
        highlighted.add(line);
      }
    }
    return highlighted;
  }, [comments]);

  const [activeCommentLine, setActiveCommentLine] = useState<number>();
  const [activeRange, setActiveRange] = useState<CommentRange>();
  const [lineSelectionAnchor, setLineSelectionAnchor] = useState<number>();
  const [selectedRange, setSelectedRange] = useState<CommentRange>();

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
    activeCommentLine,
    activeRange,
    commentsByLine,
    commentHighlightsByLine,
    onCloseCommentForm: handleCloseCommentForm,
    onCreateComment,
    onDeleteComment,
    onDeleteReply,
    onOpenCommentForm: handleOpenCommentForm,
    onSelectCommentLine: handleSelectCommentLine,
    onReplyComment,
    onResolveComment,
    onUpdateComment,
    onUpdateReply,
    selectedRange,
  };

  return (
    <CommentRenderingContext.Provider value={commentRenderingContext}>
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
    </CommentRenderingContext.Provider>
  );
};
