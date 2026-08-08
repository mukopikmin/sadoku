import { Table } from "@chakra-ui/react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";

export const renderMarkdownTable = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
) => (
  <Table.Root mb="4" size="sm" variant="outline" {...elementProps}>
    {children}
  </Table.Root>
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
}: MarkdownComponentProps<"th">) => <Table.ColumnHeader {...props} />;

export const MarkdownTableCell = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"td">) => <Table.Cell {...props} />;
