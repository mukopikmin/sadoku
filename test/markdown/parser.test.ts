import { assertEquals } from "@std/assert";
import { parseMarkdown } from "../../src/markdown/parser.ts";

Deno.test("parses markdown into block objects", () => {
  assertEquals(parseMarkdown("# Title\n\nHello\n"), [
    { type: "heading", level: 1, text: "Title" },
    { type: "paragraph", text: "Hello" },
  ]);
});

Deno.test("parses tables", () => {
  assertEquals(
    parseMarkdown(`| Name | Count |
| ---- | ----: |
| alpha | 1 |
`),
    [
      {
        type: "table",
        headers: ["Name", "Count"],
        alignments: [undefined, "right"],
        rows: [["alpha", "1"]],
      },
    ],
  );
});

Deno.test("parses mermaid fences separately from code fences", () => {
  assertEquals(parseMarkdown("```mermaid\ngraph TD\n  A --> B\n```\n"), [
    {
      type: "mermaid",
      language: "mermaid",
      code: "graph TD\n  A --> B",
    },
  ]);
});
