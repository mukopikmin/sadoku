import { expect, it } from "vitest";
import { extractTableOfContents } from "../models/tableOfContents";
it("generates unique heading anchors and ignores fenced code and nested headings", () => {
  expect(
    extractTableOfContents(
      "# Start\n\n## **Start**\n\n```md\n# Code\n```\n\n> # Quoted\n\n# 日本語",
    ),
  ).toEqual([
    { id: "start", level: 1, text: "Start" },
    { id: "start-1", level: 2, text: "Start" },
    { id: "日本語", level: 1, text: "日本語" },
  ]);
});
