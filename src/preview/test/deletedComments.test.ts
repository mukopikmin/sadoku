import { describe, expect, it } from "vitest";
import { groupDeletedComments } from "../markdown/commentable/deletedComments";
import type { StaleComment } from "../models/comment";
import { createComment } from "./commentFixtures";

const stale = (overrides: Partial<StaleComment> = {}) =>
  createComment({ state: "stale", ...overrides }) as StaleComment;

describe("deleted comment anchors", () => {
  it("uses the last overlapping deleted block for a range spanning blocks", () => {
    const comment = stale({ startLine: 3, endLine: 7 });
    expect(
      groupDeletedComments([comment], "", [
        { startLine: 1, endLine: 1 },
        { startLine: 3, endLine: 4 },
        { startLine: 6, endLine: 7 },
      ]),
    ).toEqual(new Map([[6, [comment]]]));
  });

  it("locates the deleted source after line shifts and normalizes CRLF", () => {
    const comment = stale({
      startLine: 1,
      endLine: 2,
      sourceText: "Old\r\ntext",
    });
    expect(
      groupDeletedComments([comment], "New context\n\nOld\ntext", [
        { startLine: 1, endLine: 1 },
        { startLine: 3, endLine: 4 },
      ]),
    ).toEqual(new Map([[3, [comment]]]));
  });

  it("distinguishes identical deleted blocks by their last known line positions", () => {
    const first = stale({
      id: 1,
      startLine: 1,
      endLine: 1,
      sourceText: "Same",
    });
    const second = stale({
      id: 2,
      startLine: 3,
      endLine: 3,
      sourceText: "Same",
    });
    expect(
      groupDeletedComments([first, second], "Same\n\nSame", [
        { startLine: 1, endLine: 1 },
        { startLine: 3, endLine: 3 },
      ]),
    ).toEqual(
      new Map([
        [1, [first]],
        [3, [second]],
      ]),
    );
  });

  it("uses the last known range when the source changed before deletion, even if unchanged content matches the original", () => {
    const comment = stale({ startLine: 3, endLine: 3, sourceText: "Original" });
    expect(
      groupDeletedComments([comment], "Original\n\nEdited", [
        { startLine: 3, endLine: 3 },
      ]),
    ).toEqual(new Map([[3, [comment]]]));
  });
});
