import type { Paragraph, PhrasingContent } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { paragraphDiff } from "../markdown/paragraphDiff";

const parse = (markdown: string) =>
  unified().use(remarkParse).parse(markdown).children[0] as Paragraph;
const textOf = (nodes: PhrasingContent[], omit?: string): string =>
  nodes
    .map((node) => {
      if (omit && node.data?.hName === omit) return "";
      if ("value" in node) return node.value;
      return "children" in node ? textOf(node.children, omit) : "";
    })
    .join("");

describe("paragraphDiff", () => {
  it.each([
    ["処理は30秒で終了します。", "処理は45秒で終了します。", "30", "45"],
    [
      "First line\nOld value\nLast line",
      "First line\nNew value\nLast line",
      "Old",
      "New",
    ],
    [
      "Keep **bold** and old text.",
      "Keep **bold** and new text.",
      "old",
      "new",
    ],
    ["Before 😀 after", "Before 🌸 after", "😀", "🌸"],
    ["Keep this text.", "Keep all this text.", "", "all "],
    ["Keep all this text.", "Keep this text.", "all ", ""],
  ])(
    "limits changes in %j to the changed text",
    (previous, current, removed, added) => {
      const oldParagraph = parse(previous);
      const newParagraph = parse(current);
      const oldSnapshot = JSON.stringify(oldParagraph);
      const newSnapshot = JSON.stringify(newParagraph);
      const result = paragraphDiff(oldParagraph, newParagraph)!;
      expect(textOf(result.children, "revision-inline-addition")).toBe(
        textOf(oldParagraph.children),
      );
      expect(textOf(result.children, "revision-inline-deletion")).toBe(
        textOf(newParagraph.children),
      );
      const changed = (kind: string) =>
        textOf(result.children.filter((node) => node.data?.hName === kind));
      expect(changed("revision-inline-deletion")).toBe(removed);
      expect(changed("revision-inline-addition")).toBe(added);
      expect(result.position).toEqual(newParagraph.position);
      expect(JSON.stringify(oldParagraph)).toBe(oldSnapshot);
      expect(JSON.stringify(newParagraph)).toBe(newSnapshot);
    },
  );

  it("keeps whole-block rendering when there is no shared text", () => {
    expect(paragraphDiff(parse("abc"), parse("xyz"))).toBeUndefined();
  });

  it("keeps reference links in their snapshot-specific renderer", () => {
    expect(
      paragraphDiff(
        parse("Old [link][target]\n\n[target]: https://old.example"),
        parse("New [link][target]\n\n[target]: https://new.example"),
      ),
    ).toBeUndefined();
  });
});
