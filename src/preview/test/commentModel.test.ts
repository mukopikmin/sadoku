import { describe, expect, it } from "vitest";
import {
  type CommentResponse,
  toComment,
  toCommentsDocument,
} from "../api/comments";
import { isUnresolvedComment } from "../models/comment";

const createResponse = (
  overrides: Partial<CommentResponse> = {},
): CommentResponse => ({
  body: "Check this.",
  createdAt: "2026-06-05T00:00:00.000Z",
  endLine: 3,
  id: 1,
  originalEndLine: 3,
  originalStartLine: 3,
  resolved: false,
  stale: false,
  startLine: 3,
  updatedAt: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

describe("comment model", () => {
  it.each(
    [
      [{}, "active"],
      [{ stale: true }, "stale"],
      [{ resolved: true, resolvedAt: "2026-06-06T00:00:00.000Z" }, "resolved"],
    ] as const,
  )("maps API state %j to %s", (overrides, state) => {
    expect(toComment(createResponse(overrides)).state).toBe(state);
  });

  it("gives the resolved state precedence over stale response metadata", () => {
    expect(toComment(createResponse({ resolved: true, stale: true })))
      .toMatchObject({
        id: 1,
        state: "resolved",
      });
  });

  it.each(
    [
      [{}, true],
      [{ stale: true }, true],
      [{ resolved: true }, false],
    ] as const,
  )("identifies API state %j as unresolved: %s", (overrides, expected) => {
    expect(isUnresolvedComment(toComment(createResponse(overrides))))
      .toBe(expected);
  });

  it("maps documents and replies without exposing response state flags", () => {
    const document = toCommentsDocument({
      comments: [createResponse({
        replies: [{
          body: "Agreed.",
          createdAt: "2026-06-05T01:00:00.000Z",
          id: 2,
          updatedAt: "2026-06-05T01:00:00.000Z",
        }],
      })],
      filePath: "/tmp/example.md",
    });

    expect(document).toMatchObject({
      comments: [{ replies: [{ body: "Agreed.", id: 2 }], state: "active" }],
      filePath: "/tmp/example.md",
    });
    expect(document.comments[0]).not.toHaveProperty("resolved");
    expect(document.comments[0]).not.toHaveProperty("stale");
  });
});
