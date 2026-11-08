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
