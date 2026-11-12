import type { Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

export type TablePosition = {
  startLine: number;
  endLine: number;
  columnCount: number;
};

export type TableLayout = TablePosition & {
  id: string;
  columnWidths: number[];
};

export const minimumColumnWidth = 64;
export const maximumColumnWidth = 2000;
export const clampColumnWidth = (width: number) =>
  Math.min(maximumColumnWidth, Math.max(minimumColumnWidth, Math.round(width)));

export const extractTablePositions = (markdown: string): TablePosition[] => {
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const tables: TablePosition[] = [];
  const visit = (node: Root | RootContent) => {
    if (node.type === "table" && node.position) {
      tables.push({
        startLine: node.position.start.line,
        endLine: node.position.end.line,
        columnCount: node.children[0].children.length,
      });
    } else if ("children" in node) {
      for (const child of node.children) visit(child);
    }
  };
  visit(root);
  return tables;
};
