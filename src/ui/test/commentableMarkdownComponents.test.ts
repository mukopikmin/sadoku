import { describe, expect, it, vi } from "vitest";
import { getCommentableBlockProps } from "../markdown/commentable/commentableMarkdownComponents";
import type { CommentRenderingContextValue } from "../markdown/commentable/commentRendering";
import {
  deriveRangeHighlights,
  groupCommentsByAnchorLine,
} from "../markdown/commentable/commentRanges";
import type { ActiveComment } from "../models/comment";
import { createComment, createCommentActions } from "./commentFixtures";

describe("commentable block highlights", () => {
  const comment: ActiveComment = {
    ...createComment({ startLine: 1, endLine: 10 }),
    state: "active",
  };
  const context: CommentRenderingContextValue = {
    actions: createCommentActions(),
    commentsByLine: groupCommentsByAnchorLine([comment], [1, 5, 10, 12]),
    markdown: "",
    rangeHighlights: deriveRangeHighlights([comment]),
    onCloseCommentForm: vi.fn(),
    onOpenCommentForm: vi.fn(),
    onOpenRawMarkdown: vi.fn(),
    onSelectCommentRange: vi.fn(),
  };

  it("highlights every overlapping block while keeping the thread at its anchor", () => {
    for (const sourceRange of [
      { startLine: 1, endLine: 3 },
      { startLine: 5, endLine: 8 },
      { startLine: 10, endLine: 10 },
    ]) {
      const props = getCommentableBlockProps(context, sourceRange);
      expect(props.hasRangeHighlight).toBe(true);
      expect(props.comments).toEqual(
        sourceRange.startLine === 10 ? [comment] : [],
      );
    }
    expect(
      getCommentableBlockProps(context, { startLine: 12, endLine: 12 })
        .hasRangeHighlight,
    ).toBe(false);
  });

  it("keeps saved and selected range highlights across their overlapping blocks", () => {
    const selectedRange = { startLine: 5, endLine: 12 };
    const selectedContext = {
      ...context,
      selectedRange,
      rangeHighlights: deriveRangeHighlights([comment], selectedRange),
    };
    for (const startLine of [1, 5, 10, 12]) {
      expect(
        getCommentableBlockProps(selectedContext, {
          startLine,
          endLine: startLine,
        }).hasRangeHighlight,
      ).toBe(true);
    }
    expect(
      getCommentableBlockProps(selectedContext, { startLine: 13, endLine: 13 })
        .hasRangeHighlight,
    ).toBe(false);
  });

  it("hides selection controls when an updated block no longer contains the range end", () => {
    const selectedRange = { startLine: 1, endLine: 3 };
    const shortenedBlock = { startLine: 1, endLine: 2 };
    const selectedContext = { ...context, selectedRange, actionLine: 1 };

    expect(
      getCommentableBlockProps(selectedContext, shortenedBlock)
        .isRangeActionLine,
    ).toBe(false);
    expect(
      getCommentableBlockProps(
        { ...selectedContext, activeRange: selectedRange },
        shortenedBlock,
      ).isAdding,
    ).toBe(false);
  });
});
