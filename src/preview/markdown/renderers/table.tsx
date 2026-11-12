import { Box, Table } from "@chakra-ui/react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownTable = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
  containerClassName?: string,
  reserveCommentGutter = false,
) => (
  <Box
    className={containerClassName}
    // Keep the desktop comment gutter inside the scroll viewport without
    // moving the table away from the document's normal left edge.
    ps={containerClassName ? { md: "10" } : undefined}
    ms={containerClassName ? { md: "-10" } : undefined}
    maxW={
      containerClassName
        ? { base: "100%", md: "calc(100% + var(--chakra-spacing-10))" }
        : "100%"
    }
    overflowX="auto"
    py="2"
    pb={reserveCommentGutter ? { md: "12" } : undefined}
    w="fit-content"
  >
    <Table.Root
      fontSize="inherit"
      m="0"
      maxW="100%"
      size="sm"
      variant="outline"
      w="auto"
      {...elementProps}
    >
      {children}
    </Table.Root>
  </Box>
);

export const MarkdownTable = ({
  children,
  node: _node,
  ...props
}: MarkdownComponentProps<"table">) => renderMarkdownTable(props, children);

export const MarkdownTableHeader = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"thead">) => <Table.Header {...props} />;

export const MarkdownTableBody = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"tbody">) => <Table.Body {...props} />;

export const MarkdownTableRow = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"tr">) => <Table.Row {...props} />;

export const MarkdownTableColumnHeader = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"th">) => (
  <Table.ColumnHeader overflowWrap="anywhere" {...props} />
);

export const MarkdownTableCell = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"td">) => (
  <Table.Cell overflowWrap="anywhere" {...props} />
);
