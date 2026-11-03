import type { StaleComment } from "../../models/comment";
import type { CommentRange } from "./commentRanges";

const overlaps = (left: CommentRange, right: CommentRange) =>
  left.startLine <= right.endLine && left.endLine >= right.startLine;

// A stale comment retains the coordinates from immediately before deletion.
// Its original source can locate it when those coordinates belong to an older snapshot.
export const groupDeletedComments = (
  comments: readonly StaleComment[],
  previousMarkdown: string,
  deletedRanges: readonly CommentRange[],
): Map<number, StaleComment[]> => {
  const grouped = new Map<number, StaleComment[]>();
  if (comments.length === 0 || deletedRanges.length === 0) return grouped;
  const lines = previousMarkdown.split(/\r?\n/);
  for (const comment of comments) {
    let range: CommentRange = comment;
    if (comment.sourceText !== undefined && comment.sourceText !== "") {
      const sourceLines = comment.sourceText.split(/\r?\n/);
      const matches: number[] = [];
      for (
        let index = 0;
        index <= lines.length - sourceLines.length;
        index += 1
      ) {
        if (
          sourceLines.every((line, offset) => line === lines[index + offset]) &&
          deletedRanges.some((deleted) =>
            overlaps(deleted, {
              startLine: index + 1,
              endLine: index + sourceLines.length,
            }),
          )
        ) {
          matches.push(index + 1);
        }
      }
      const startLine = matches.sort(
        (left, right) =>
          Math.abs(left - comment.startLine) -
          Math.abs(right - comment.startLine),
      )[0];
      if (startLine !== undefined) {
        range = { startLine, endLine: startLine + sourceLines.length - 1 };
      }
    }
    const anchor = deletedRanges.findLast((deleted) =>
      overlaps(deleted, range),
    );
    if (anchor) {
      grouped.set(anchor.startLine, [
        ...(grouped.get(anchor.startLine) ?? []),
        comment,
      ]);
    }
  }
  return grouped;
};
