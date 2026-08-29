import {
  Box,
  IconButton,
  Link,
  List,
  Popover,
  Portal,
  Text,
} from "@chakra-ui/react";
import GithubSlugger from "github-slugger";
import type { Heading, Root } from "mdast";
import { useMemo, useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root
      onOpenChange={({ open }) => setOpen(open)}
      open={open}
      positioning={{ placement: "top-end" }}
    >
      <Box
        bottom={{ base: "4", md: "6" }}
        position="fixed"
        right="max(var(--chakra-spacing-8), calc((100vw - 980px) / 2 + var(--chakra-spacing-8)))"
        zIndex="dropdown"
      >
        <Popover.Trigger asChild>
          <IconButton
            aria-label="Table of contents"
            bg="canvas"
            boxShadow="md"
            color="fg"
            rounded="full"
            size="lg"
            type="button"
            variant="outline"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="1em"
              viewBox="0 0 16 16"
              width="1em"
            >
              <path
                d="M5 4h9M5 8h9M5 12h9"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
              <circle cx="2" cy="4" fill="currentColor" r="1" />
              <circle cx="2" cy="8" fill="currentColor" r="1" />
              <circle cx="2" cy="12" fill="currentColor" r="1" />
            </svg>
          </IconButton>
        </Popover.Trigger>
      </Box>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            maxH="min(60vh, 32rem)"
            maxW="calc(100vw - 2rem)"
            overflowY="auto"
            textStyle="md"
            width="20rem"
          >
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body>
              <Text fontWeight="semibold">Table of contents</Text>
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
                          <Link
                            href={`#${item.id}`}
                            onClick={() => setOpen(false)}
                          >
                            {item.text}
                          </Link>
                        </List.Item>
                      ))}
                    </List.Root>
                  </Box>
                )}
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
