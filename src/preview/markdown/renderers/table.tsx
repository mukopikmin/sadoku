import { chakra, Table } from "@chakra-ui/react";
import { Children, isValidElement, useContext } from "react";
import type React from "react";
import type {
  MarkdownComponentProps,
  MarkdownElementProps,
} from "../rendererTypes";
import {
  ResizableMarkdownTable,
  TableColumnIndexContext,
  TableColumnResizeContext,
} from "../ResizableMarkdownTable";
import {
  maximumColumnWidth,
  minimumColumnWidth,
} from "../../models/tableLayout";

// Inline-flex links form unbreakable boxes even when the cell allows wrapping.
const cellContentStyles = {
  "& a": { display: "inline" },
  "& code": { whiteSpace: "normal", overflowWrap: "anywhere" },
} as const;

export const renderMarkdownTable = (
  elementProps: Omit<MarkdownElementProps, "children">,
  children: React.ReactNode,
  startLine?: number,
) => (
  <ResizableMarkdownTable elementProps={elementProps} startLine={startLine}>
    {children}
  </ResizableMarkdownTable>
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
  children,
  ...props
}: MarkdownComponentProps<"tr">) => {
  let index = 0;
  return (
    <Table.Row {...props}>
      {Children.map(children, (child) =>
        isValidElement(child) ? (
          <TableColumnIndexContext.Provider value={index++}>
            {child}
          </TableColumnIndexContext.Provider>
        ) : (
          child
        ),
      )}
    </Table.Row>
  );
};

export const MarkdownTableColumnHeader = ({
  node: _node,
  children,
  ...props
}: MarkdownComponentProps<"th">) => {
  const resize = useContext(TableColumnResizeContext);
  const index = useContext(TableColumnIndexContext);
  return (
    <Table.ColumnHeader
      overflowWrap="anywhere"
      css={cellContentStyles}
      position="relative"
      {...props}
    >
      {children}
      {resize && index !== undefined && (
        <chakra.button
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize column ${index + 1}`}
          aria-valuemin={minimumColumnWidth}
          aria-valuemax={maximumColumnWidth}
          aria-valuenow={resize.widths[index] || undefined}
          aria-valuetext={
            resize.widths[index]
              ? `${resize.widths[index]} pixels`
              : "Automatic width"
          }
          title="Drag or use arrow keys to resize. Double-click or press Home for automatic width."
          position="absolute"
          top="0"
          bottom="0"
          right="0"
          w="2"
          cursor="col-resize"
          touchAction="none"
          userSelect="none"
          bg="transparent"
          borderRightWidth="2px"
          borderColor="border"
          _hover={{ borderColor: "fg" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "accent" }}
          {...resize.handleProps(index)}
        />
      )}
    </Table.ColumnHeader>
  );
};

export const MarkdownTableCell = ({
  node: _node,
  ...props
}: MarkdownComponentProps<"td">) => (
  <Table.Cell overflowWrap="anywhere" css={cellContentStyles} {...props} />
);
