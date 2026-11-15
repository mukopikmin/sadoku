import GithubSlugger from "github-slugger";
import type { Heading, Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import { unified } from "unified";

export type TableOfContentsItem = {
  id: string;
  level: number;
  text: string;
};

export type TableOfContentsNode = TableOfContentsItem & {
  children: TableOfContentsNode[];
};

export const buildTableOfContentsTree = (
  items: TableOfContentsItem[],
): TableOfContentsNode => {
  const root: TableOfContentsNode = {
    id: "",
    level: 0,
    text: "Table of contents",
    children: [],
  };
  const parents = [root];
  for (const item of items) {
    while (parents.length > 1 && parents.at(-1)!.level >= item.level) {
      parents.pop();
    }
    const node = { ...item, children: [] };
    parents.at(-1)!.children.push(node);
    parents.push(node);
  }
  return root;
};

export const extractTableOfContents = (
  markdown: string,
): TableOfContentsItem[] => {
  const tree = unified().use(remarkParse).parse(markdown) as Root;
  const slugger = new GithubSlugger();
  return tree.children
    .filter((node): node is Heading => node.type === "heading")
    .map((heading) => {
      const text = toString(heading);
      return {
        id: slugger.slug(text),
        level: heading.depth,
        text,
      };
    });
};
