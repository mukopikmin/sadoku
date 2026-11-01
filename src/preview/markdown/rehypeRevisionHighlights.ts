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
  { changedLines, showHtmlComments = true }: {
    changedLines: ReadonlySet<number>;
    showHtmlComments?: boolean;
  },
) =>
(tree: Root) => {
  const highlight = (children: Element["children"], changed: boolean): Element => ({
    type: "element",
    tagName: "revision-highlight",
    properties: { "data-revision-changed": changed ? "true" : "false" },
    children,
  });
  const visit = (parent: Root | Element) => {
    parent.children = parent.children.map((node) => {
      if (node.type !== "element") return node;
      if (node.tagName === "html-comment" && !showHtmlComments) return node;
      const start = node.position?.start.line;
      const end = node.position?.end.line;
      // Tight list items have inline children rather than paragraph elements.
      // Keep nested lists outside the highlight so their unchanged items stay clear.
      if (
        node.tagName === "li" && start !== undefined && end !== undefined &&
        !node.children.some((child) => child.type === "element" &&
          (highlightedBlocks.has(child.tagName) || child.tagName === "blockquote")
        )
      ) {
        const nestedIndex = node.children.findIndex((child) =>
          child.type === "element" &&
          (child.tagName === "ul" || child.tagName === "ol")
        );
        const ownEnd = nestedIndex < 0
          ? end
          : (node.children[nestedIndex].position?.start.line ?? end) - 1;
        const split = nestedIndex < 0 ? node.children.length : nestedIndex;
        const nested = { ...node, children: node.children.slice(split) };
        visit(nested);
        node.children = [
          highlight(
            node.children.slice(0, split),
            containsChangedLine(changedLines, start, ownEnd),
          ),
          ...nested.children,
        ];
        return node;
      }
      if (
        highlightedBlocks.has(node.tagName) && start !== undefined &&
        end !== undefined
      ) {
        return highlight([node], containsChangedLine(changedLines, start, end));
      }
      visit(node);
      return node;
    });
  };
  visit(tree);
};
