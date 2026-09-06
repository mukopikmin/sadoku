import type { ActiveComment } from "../../models/comment";

export type CommentRange = { endLine: number; startLine: number };

export type RangeHighlight = CommentRange & {
  kind: "comment" | "selection";
};

export type CommentRangeSelection = {
  anchorLine?: number;
  range?: CommentRange;
};

export const isLineInRange = (
  line: number,
  range: CommentRange,
): boolean => line >= range.startLine && line <= range.endLine;

export const getCommentAnchorLine = (
  comment: CommentRange,
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

export const groupCommentsByAnchorLine = (
  comments: readonly ActiveComment[],
  commentableLines: readonly number[],
): Map<number, ActiveComment[]> => {
  const grouped = new Map<number, ActiveComment[]>();
  for (const comment of comments) {
    const anchorLine = getCommentAnchorLine(comment, commentableLines);
    grouped.set(anchorLine, [
      ...(grouped.get(anchorLine) ?? []),
      comment,
    ]);
  }
  return grouped;
};

export const mergeCommentRanges = (
  ranges: readonly CommentRange[],
): CommentRange[] => {
  const sorted = [...ranges].sort((left, right) =>
    left.startLine - right.startLine || left.endLine - right.endLine
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

export const subtractCommentRange = (
  ranges: readonly CommentRange[],
  excluded?: CommentRange,
): CommentRange[] => {
  if (!excluded) return ranges.map((range) => ({ ...range }));

  return ranges.flatMap((range) => {
    if (
      excluded.endLine < range.startLine ||
      excluded.startLine > range.endLine
    ) return [{ ...range }];

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

export const deriveRangeHighlights = (
  comments: readonly CommentRange[],
  selectedRange?: CommentRange,
): RangeHighlight[] => {
  const continuousCommentRanges = mergeCommentRanges(
    comments.filter((comment) => comment.startLine < comment.endLine),
  );
  const continuousSelectedRange = selectedRange &&
      selectedRange.startLine < selectedRange.endLine
    ? selectedRange
    : undefined;

  return [
    ...subtractCommentRange(
      continuousCommentRanges,
      continuousSelectedRange,
    ).map((range) => ({ ...range, kind: "comment" as const })),
    ...(continuousSelectedRange
      ? [{ ...continuousSelectedRange, kind: "selection" as const }]
      : []),
  ];
};

export const getSingleLineCommentHighlights = (
  comments: readonly CommentRange[],
): Set<number> =>
  new Set(
    comments.filter((comment) => comment.startLine === comment.endLine).map(
      (comment) => comment.startLine,
    ),
  );

export const resolveCommentRangeSelection = (
  currentRange: CommentRange | undefined,
  clickedRange: CommentRange,
  anchorLine: number | undefined,
  extend: boolean,
): CommentRangeSelection => {
  if (
    currentRange?.startLine === clickedRange.startLine &&
    currentRange.endLine === clickedRange.endLine
  ) return {};

  if (!extend || anchorLine === undefined) {
    return {
      anchorLine: clickedRange.startLine,
      range: { ...clickedRange },
    };
  }

  return {
    anchorLine,
    range: {
      endLine: Math.max(anchorLine, clickedRange.endLine),
      startLine: Math.min(anchorLine, clickedRange.startLine),
    },
  };
};
