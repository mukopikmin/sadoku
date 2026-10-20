import { Box, Table } from "@chakra-ui/react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownTable = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Box maxW="100%" overflowX="auto" py="2" w="fit-content">
    <Table.Root
      fontSize="inherit"
      lineHeight="inherit"
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
