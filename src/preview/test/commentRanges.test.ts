import { describe, expect, it } from "vitest";
import {
  deriveRangeHighlights,
  getCommentAnchorLine,
  getSingleLineCommentHighlights,
  mergeCommentRanges,
  resolveCommentRangeSelection,
  subtractCommentRange,
} from "../markdown/commentable/commentRanges";

describe("comment ranges", () => {
  it("merges sorted, overlapping, and adjacent ranges without mutating input", () => {
    const ranges = [
      { startLine: 8, endLine: 9 },
      { startLine: 1, endLine: 3 },
      { startLine: 3, endLine: 5 },
      { startLine: 6, endLine: 6 },
    ];

    expect(mergeCommentRanges(ranges)).toEqual([
      { startLine: 1, endLine: 6 },
      { startLine: 8, endLine: 9 },
    ]);
    expect(ranges).toEqual([
      { startLine: 8, endLine: 9 },
      { startLine: 1, endLine: 3 },
      { startLine: 3, endLine: 5 },
      { startLine: 6, endLine: 6 },
    ]);
  });

  it("subtracts an excluded range from its saved highlights", () => {
    expect(subtractCommentRange(
      [
        { startLine: 1, endLine: 5 },
        { startLine: 8, endLine: 10 },
      ],
      { startLine: 3, endLine: 8 },
    )).toEqual([
      { startLine: 1, endLine: 2 },
      { startLine: 9, endLine: 10 },
    ]);
    expect(subtractCommentRange(
      [{ startLine: 1, endLine: 5 }],
      { startLine: 1, endLine: 5 },
    )).toEqual([]);
  });

  it("anchors comments to the last block in range or the nearest block", () => {
    expect(getCommentAnchorLine(
      { startLine: 2, endLine: 6 },
      [1, 3, 5, 8],
    )).toBe(5);
    expect(getCommentAnchorLine(
      { startLine: 4, endLine: 4 },
      [1, 6, 9],
    )).toBe(6);
    expect(getCommentAnchorLine(
      { startLine: 4, endLine: 7 },
      [],
    )).toBe(7);
  });

  it("derives continuous highlights with the active selection on top", () => {
    expect(deriveRangeHighlights(
      [
        { startLine: 1, endLine: 3 },
        { startLine: 4, endLine: 5 },
        { startLine: 7, endLine: 7 },
      ],
      { startLine: 2, endLine: 3 },
    )).toEqual([
      { startLine: 1, endLine: 1, kind: "comment" },
      { startLine: 4, endLine: 5, kind: "comment" },
      { startLine: 2, endLine: 3, kind: "selection" },
    ]);
    expect([...getSingleLineCommentHighlights([
      { startLine: 1, endLine: 3 },
      { startLine: 7, endLine: 7 },
      { startLine: 7, endLine: 7 },
    ])]).toEqual([7]);
  });

  it("selects, extends, replaces, and clears comment ranges", () => {
    expect(resolveCommentRangeSelection(
      undefined,
      { startLine: 3, endLine: 3 },
      undefined,
      false,
    )).toEqual({
      anchorLine: 3,
      range: { startLine: 3, endLine: 3 },
    });
    expect(resolveCommentRangeSelection(
      { startLine: 3, endLine: 3 },
      { startLine: 7, endLine: 8 },
      3,
      true,
    )).toEqual({
      anchorLine: 3,
      range: { startLine: 3, endLine: 8 },
    });
    expect(resolveCommentRangeSelection(
      { startLine: 3, endLine: 8 },
      { startLine: 1, endLine: 1 },
      3,
      false,
    )).toEqual({
      anchorLine: 1,
      range: { startLine: 1, endLine: 1 },
    });
    expect(resolveCommentRangeSelection(
      { startLine: 1, endLine: 1 },
      { startLine: 1, endLine: 1 },
      1,
      false,
    )).toEqual({});
  });
});
