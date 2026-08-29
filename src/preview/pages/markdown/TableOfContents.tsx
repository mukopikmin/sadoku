import { Box, Collapsible, Link, List, Text } from "@chakra-ui/react";
import GithubSlugger from "github-slugger";
import type { Heading, Root } from "mdast";
import { useMemo } from "react";
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
  return tree.children.filter((node): node is Heading =>
    node.type === "heading"
  )
    .map((heading) => {
      const text = toString(heading);
      return {
        id: slugger.slug(text),
        level: heading.depth,
        text,
      };
    });
};

export const TableOfContents = ({ markdown }: { markdown: string }) => {
  const items = useMemo(() => extractTableOfContents(markdown), [markdown]);

  return (
    <Collapsible.Root>
      <Collapsible.Trigger
        alignItems="center"
        display="flex"
        gap="2"
        textAlign="start"
        width="full"
      >
        <Collapsible.Indicator
          _open={{ transform: "rotate(90deg)" }}
          aria-hidden="true"
          fontSize="sm"
          lineHeight="1"
          transition="transform 0.2s"
        >
          ▶
        </Collapsible.Indicator>
        <Text fontWeight="semibold">Table of contents</Text>
      </Collapsible.Trigger>
      <Collapsible.Content>
        {items.length === 0
          ? <Text pt="2">No headings</Text>
          : (
            <Box as="nav" aria-label="Table of contents" pt="2">
              <List.Root listStyle="none" m="0">
                {items.map((item) => (
                  <List.Item
                    data-heading-level={item.level}
                    key={item.id}
                    ps={`${(item.level - 1) * 4}`}
                  >
                    <Link href={`#${item.id}`}>{item.text}</Link>
                  </List.Item>
                ))}
              </List.Root>
            </Box>
          )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
