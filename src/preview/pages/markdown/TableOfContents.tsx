import {
  Box,
  Button,
  Link,
  List,
  Popover,
  Portal,
  Text,
} from "@chakra-ui/react";
import { List as ListIcon } from "lucide-react";
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
      size="lg"
    >
      <Popover.Trigger asChild>
        <Button
          size="sm"
          type="button"
          variant="outline"
        >
          <ListIcon aria-hidden="true" />
          Table of contents
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            css={{ "--popover-size": "sizes.sm" }}
            overflowY="auto"
            textStyle="sm"
          >
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body>
              <Text fontWeight="semibold">Table of contents</Text>
              {items.length === 0 ? <Text pt="2">No headings</Text> : (
                <Box
                  as="nav"
                  aria-label="Table of contents"
                  lineHeight="1.7"
                  pt="2"
                >
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
