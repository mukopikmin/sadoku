import { expect, it } from "vitest";
import {
  buildTableOfContentsTree,
  extractTableOfContents,
} from "../models/tableOfContents";
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

it("nests headings under the nearest preceding lower level and handles skipped levels", () => {
  const items = extractTableOfContents(
    "### Intro\n\n###### Deep\n\n#### Middle\n\n## Next\n\n# End",
  );
  const root = buildTableOfContentsTree(items);
  expect(root.children.map((node) => node.text)).toEqual([
    "Intro",
    "Next",
    "End",
  ]);
  expect(root.children[0].children.map((node) => node.text)).toEqual([
    "Deep",
    "Middle",
  ]);
  expect(root.children[1].children).toEqual([]);
});
