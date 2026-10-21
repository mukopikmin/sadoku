import type { Element, Root } from "hast";
import { containsChangedLine } from "./revisionDiff";

const highlightedBlocks = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "pre",
  "table",
  "hr",
  "html-comment",
]);

export const rehypeRevisionHighlights = (
  { changedLines }: { changedLines: ReadonlySet<number> },
) =>
(tree: Root) => {
  const highlight = (children: Element["children"]): Element => ({
    type: "element",
    tagName: "revision-highlight",
    properties: {},
    children,
  });
  const visit = (parent: Root | Element) => {
    parent.children = parent.children.map((node) => {
      if (node.type !== "element") return node;
      const start = node.position?.start.line;
      const end = node.position?.end.line;
      // Tight list items have inline children rather than paragraph elements.
      // Keep nested lists outside the highlight so their unchanged items stay clear.
      if (node.tagName === "li" && start !== undefined && end !== undefined) {
        const nestedIndex = node.children.findIndex((child) =>
          child.type === "element" &&
          (child.tagName === "ul" || child.tagName === "ol")
        );
        const ownEnd = nestedIndex < 0
          ? end
          : (node.children[nestedIndex].position?.start.line ?? end) - 1;
        if (containsChangedLine(changedLines, start, ownEnd)) {
          const split = nestedIndex < 0 ? node.children.length : nestedIndex;
          const nested = { ...node, children: node.children.slice(split) };
          visit(nested);
          node.children = [
            highlight(node.children.slice(0, split)),
            ...nested.children,
          ];
          return node;
        }
      }
      if (
        highlightedBlocks.has(node.tagName) && start !== undefined &&
        end !== undefined && containsChangedLine(changedLines, start, end)
      ) {
        return highlight([node]);
      }
      visit(node);
      return node;
    });
  };
  visit(tree);
};
