import { createContext, useContext } from "react";
import type { CommentActions } from "../../api/commentActions";
import type { ActiveComment } from "../../models/comment";
import type { MarkdownElementProps } from "../../markdown/markdownRenderers";

export type CommentRange = { endLine: number; startLine: number };

type SourcePosition = {
  start?: {
    line?: number;
  };
};

export type SourceNode = {
  position?: SourcePosition;
};

export type CommentableComponentProps = MarkdownElementProps & {
  node?: SourceNode;
};

export type CommentControlProps = {
  actions: CommentActions;
  activeCommentLine?: number;
  activeRange?: CommentRange;
  onCloseCommentForm: () => void;
  onOpenCommentForm: () => void;
  onSelectCommentLine: (line: number) => void;
  selectedRange?: CommentRange;
};

export type CommentRenderingContextValue = CommentControlProps & {
  commentsByLine: Map<number, ActiveComment[]>;
  commentHighlightsByLine: Set<number>;
};

export const SourceLineContext = createContext<ReadonlySet<number>>(new Set());

export const CommentRenderingContext = createContext<
  CommentRenderingContextValue | undefined
>(undefined);

export const useCommentRenderingContext = (): CommentRenderingContextValue => {
  const value = useContext(CommentRenderingContext);
  if (!value) throw new Error("Missing comment rendering context.");
  return value;
};

export const getSourceLine = (
  props: { node?: SourceNode },
): number | undefined => props.node?.position?.start?.line;

export const isLineInRange = (line: number, range: CommentRange): boolean =>
  line >= range.startLine && line <= range.endLine;

export const formatRangeLabel = (range: CommentRange): string =>
  range.startLine === range.endLine
    ? `line ${range.startLine}`
    : `lines ${range.startLine}-${range.endLine}`;

export const hasTextSelectionWithin = (element: Element): boolean => {
  const selection = element.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed) return false;

  return element.contains(selection.anchorNode) ||
    element.contains(selection.focusNode);
};
