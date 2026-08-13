import type { PreviewComment, PreviewCommentsDocument } from "./types.ts";
import type { CommentsStore, MarkdownSourceReader } from "./ports.ts";

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

type LineRange = { endLine: number; startLine: number };

const createLineMapping = (
  before: string,
  after: string,
): Map<number, LineRange> => {
  const oldLines = getMarkdownLines(before);
  const newLines = getMarkdownLines(after);
  const width = newLines.length + 1;
  const lengths = new Uint32Array((oldLines.length + 1) * width);

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      const index = oldIndex * width + newIndex;
      lengths[index] = oldLines[oldIndex] === newLines[newIndex]
        ? lengths[(oldIndex + 1) * width + newIndex + 1] + 1
        : Math.max(
          lengths[(oldIndex + 1) * width + newIndex],
          lengths[oldIndex * width + newIndex + 1],
        );
    }
  }

  const matches: Array<{ newIndex: number; oldIndex: number }> = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      matches.push({ oldIndex, newIndex });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      lengths[(oldIndex + 1) * width + newIndex] >=
        lengths[oldIndex * width + newIndex + 1]
    ) {
      oldIndex += 1;
    } else {
      newIndex += 1;
    }
  }

  const mapping = new Map<number, LineRange>();
  let previousOldIndex = -1;
  let previousNewIndex = -1;
  for (
    const match of [
      ...matches,
      { oldIndex: oldLines.length, newIndex: newLines.length },
    ]
  ) {
    const deletedStart = previousOldIndex + 1;
    const deletedEnd = match.oldIndex - 1;
    const insertedStart = previousNewIndex + 1;
    const insertedEnd = match.newIndex - 1;
    if (deletedStart <= deletedEnd && insertedStart <= insertedEnd) {
      for (let index = deletedStart; index <= deletedEnd; index += 1) {
        mapping.set(index + 1, {
          startLine: insertedStart + 1,
          endLine: insertedEnd + 1,
        });
      }
    }
    if (match.oldIndex < oldLines.length) {
      mapping.set(match.oldIndex + 1, {
        startLine: match.newIndex + 1,
        endLine: match.newIndex + 1,
      });
    }
    previousOldIndex = match.oldIndex;
    previousNewIndex = match.newIndex;
  }
  return mapping;
};

const rebaseCommentPosition = (
  comment: PreviewComment,
  mapping: Map<number, LineRange>,
): PreviewComment => {
  if (comment.stale) return comment;
  const mappedRanges: LineRange[] = [];
  for (let line = comment.startLine; line <= comment.endLine; line += 1) {
    const mapped = mapping.get(line);
    if (mapped) mappedRanges.push(mapped);
  }
  if (mappedRanges.length === 0) {
    return { ...comment, displayLine: comment.startLine, stale: true };
  }
  const startLine = Math.min(...mappedRanges.map((range) => range.startLine));
  const endLine = Math.max(...mappedRanges.map((range) => range.endLine));
  return {
    ...comment,
    displayLine: startLine,
    endLine,
    stale: false,
    startLine,
  };
};

export const resolveCommentPosition = (
  comment: PreviewComment,
  markdown: string,
): PreviewComment => {
  const sourceText = comment.sourceText ??
    getLineRangeText(markdown, comment.startLine, comment.endLine) ??
    "";
  const sourceHash = comment.sourceHash ?? hashSourceText(sourceText);

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
  markdownSource: string,
  commentsStore: CommentsStore,
  readMarkdown: MarkdownSourceReader,
): Promise<PreviewCommentsDocument> => {
  const [document, markdown] = await Promise.all([
    commentsStore.read(filePath),
    readMarkdown(markdownSource),
  ]);
  if (document.sourceSnapshot === markdown) {
    return {
      ...document,
      comments: document.comments.map((comment) => ({
        ...comment,
        displayLine: comment.displayLine ?? comment.startLine,
      })),
    };
  }

  const mapping = document.sourceSnapshot === undefined
    ? undefined
    : createLineMapping(document.sourceSnapshot, markdown);
  const comments = document.comments.map((comment) =>
    mapping === undefined
      ? resolveCommentPosition(comment, markdown)
      : rebaseCommentPosition(comment, mapping)
  );
  const resolvedDocument = {
    ...document,
    comments,
    filePath,
    ...(document.sourceSnapshot === undefined
      ? {}
      : { previousSourceSnapshot: document.sourceSnapshot }),
    sourceSnapshot: markdown,
  };
  if (document.comments.length === 0) return resolvedDocument;
  await commentsStore.write(filePath, resolvedDocument);
  return resolvedDocument;
};
