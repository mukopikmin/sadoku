import type { PreviewComment, PreviewCommentsDocument } from "./types.ts";
import { readCommentsDocument } from "./storage.ts";
import { readMarkdownSource } from "../source.ts";

const lineSearchRadius = 40;

const getMarkdownLines = (markdown: string): string[] => markdown.split("\n");

export const getLineText = (
  markdown: string,
  line: number,
): string | undefined => getMarkdownLines(markdown)[line - 1];

export const getLineRangeText = (
  markdown: string,
  startLine: number,
  endLine: number,
): string | undefined => {
  if (startLine < 1 || endLine < startLine) return undefined;
  const lines = getMarkdownLines(markdown);
  if (endLine > lines.length) return undefined;
  return lines.slice(startLine - 1, endLine).join("\n");
};

export const hashSourceText = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const resolveCommentPosition = (
  comment: PreviewComment,
  markdown: string,
): PreviewComment => {
  const sourceText = comment.sourceText ??
    getLineRangeText(markdown, comment.startLine, comment.endLine) ??
    "";
  const sourceHash = comment.sourceHash ?? hashSourceText(sourceText);
  const currentRangeText = getLineRangeText(
    markdown,
    comment.startLine,
    comment.endLine,
  );

  if (
    currentRangeText !== undefined &&
    currentRangeText === sourceText &&
    hashSourceText(currentRangeText) === sourceHash
  ) {
    return {
      ...comment,
      displayLine: comment.startLine,
      originalEndLine: comment.endLine,
      originalStartLine: comment.startLine,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  const lines = getMarkdownLines(markdown);
  const startSearchLine = Math.max(1, comment.startLine - lineSearchRadius);
  const searchEndLine = Math.min(
    lines.length,
    comment.startLine + lineSearchRadius,
  );
  const rangeLength = comment.endLine - comment.startLine + 1;
  const matchingLines: Array<{ endLine: number; startLine: number }> = [];

  for (let line = startSearchLine; line <= searchEndLine; line += 1) {
    const candidateEndLine = line + rangeLength - 1;
    const lineText = getLineRangeText(markdown, line, candidateEndLine);
    if (
      lineText !== undefined &&
      lineText === sourceText &&
      hashSourceText(lineText) === sourceHash
    ) {
      matchingLines.push({ endLine: candidateEndLine, startLine: line });
    }
  }

  if (matchingLines.length === 1) {
    const match = matchingLines[0];
    return {
      ...comment,
      displayLine: match.startLine,
      endLine: match.endLine,
      originalEndLine: comment.endLine,
      originalStartLine: comment.startLine,
      sourceHash,
      sourceText,
      stale: false,
      startLine: match.startLine,
    };
  }

  return {
    ...comment,
    displayLine: comment.startLine,
    originalEndLine: comment.endLine,
    originalStartLine: comment.startLine,
    sourceHash,
    sourceText,
    stale: true,
  };
};

export const readResolvedCommentsDocument = async (
  filePath: string,
  markdownSource = filePath,
): Promise<PreviewCommentsDocument> => {
  const [document, markdown] = await Promise.all([
    readCommentsDocument(filePath),
    readMarkdownSource(markdownSource),
  ]);
  return {
    comments: document.comments.map((comment) =>
      resolveCommentPosition(comment, markdown)
    ),
    filePath,
  };
};
