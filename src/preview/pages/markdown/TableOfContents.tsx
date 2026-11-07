import {
  Box,
  IconButton,
  Link,
  List,
  Popover,
  Portal,
  Text,
} from "@chakra-ui/react";
import { List as ListIcon } from "lucide-react";
import { memo } from "react";
import { useTableOfContents } from "../../hooks/useTableOfContents";
import { Tooltip } from "../../components/ui/tooltip";

export const TableOfContents = memo(function TableOfContents({
  markdown,
}: {
  markdown: string;
}) {
  const contents = useTableOfContents(markdown);

  return (
    <Popover.Root
      onOpenChange={({ open }) => contents.setOpen(open)}
      open={contents.open}
      positioning={{ placement: "bottom-end" }}
      size="lg"
    >
      <Tooltip content="Table of contents">
        <span style={{ display: "inline-flex" }}>
          <Popover.Trigger asChild>
            <IconButton
              aria-label="Table of contents"
              size="sm"
              type="button"
              variant="outline"
            >
              <ListIcon aria-hidden="true" />
            </IconButton>
          </Popover.Trigger>
        </span>
      </Tooltip>
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
              {contents.state.status === "empty" ? (
                <Text pt="2">No headings</Text>
              ) : (
                <Box
                  as="nav"
                  aria-label="Table of contents"
                  lineHeight="1.7"
                  pt="2"
                >
                  <List.Root listStyle="none" m="0">
                    {contents.state.items.map((item) => (
                      <List.Item
                        data-heading-level={item.level}
                        key={item.id}
                        ps={`${(item.level - 1) * 4}`}
                      >
                        <Link
                          href={`#${item.id}`}
                          onClick={() => contents.setOpen(false)}
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
});
