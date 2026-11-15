import { Box, Stack, Table, Text } from "@chakra-ui/react";
import { TableResizeControllerContext } from "./tableResizeControllerContext";
import { createContext, useContext, type ReactNode } from "react";
import type { TableLayout } from "../models/tableLayout";
import { minimumColumnWidth } from "../models/tableLayout";
import type { MarkdownElementProps } from "./rendererTypes";
import { TableLayoutContext } from "./tableLayoutContext";
import { useTableColumnResize } from "./useTableColumnResize";

export const TableColumnIndexContext = createContext<number | undefined>(
  undefined,
);
export const TableColumnResizeContext = createContext<
  ReturnType<typeof useTableColumnResize> | undefined
>(undefined);

type Props = {
  elementProps: Omit<MarkdownElementProps, "children">;
  children: ReactNode;
  startLine?: number;
  containerClassName?: string;
};

export const ResizableMarkdownTable = ({ startLine, ...props }: Props) => {
  const context = useContext(TableLayoutContext);
  const layout =
    context?.state.status === "ready"
      ? context.state.tables.find((table) => table.startLine === startLine)
      : undefined;
  if (!layout || !context) return <StaticMarkdownTable {...props} />;
  return (
    <ManagedMarkdownTable
      key={layout.id}
      {...props}
      layout={layout}
      save={context.save}
    />
  );
};

export const StaticMarkdownTable = ({
  elementProps,
  children,
  containerClassName,
}: Props) => (
  <Box
    className={containerClassName}
    maxW="100%"
    overflowX="auto"
    py="2"
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

const ManagedMarkdownTable = ({
  layout,
  save,
  containerClassName,
  elementProps,
  children,
}: Props & {
  layout: TableLayout;
  save: (id: string, widths: number[]) => Promise<TableLayout>;
}) => {
  const resize = useTableColumnResize(layout, save);
  const widths = Array.from(
    { length: layout.columnCount },
    (_, index) => resize.widths[index] ?? 0,
  );
  const adjusted = widths.some((width) => width > 0);
  const minimumWidth = widths.reduce(
    (sum, width) => sum + (width || minimumColumnWidth),
    0,
  );
  const allAdjusted = widths.every((width) => width > 0);
  let tableWidth = "auto";
  if (adjusted && allAdjusted) {
    tableWidth = `${minimumWidth}px`;
  } else if (adjusted) {
    tableWidth = "100%";
  }
  return (
    <TableResizeControllerContext.Provider
      value={{ ...resize, tableId: layout.id }}
    >
      <TableColumnResizeContext.Provider value={resize}>
        <Stack
          className={containerClassName}
          gap="1"
          py="2"
          minW="0"
          maxW="100%"
        >
          <Box
            maxW="100%"
            overflowX="auto"
            tabIndex={0}
            aria-label="Scrollable table"
          >
            <Table.Root
              fontSize="inherit"
              m="0"
              size="sm"
              variant="outline"
              tableLayout={adjusted ? "fixed" : "auto"}
              w={tableWidth}
              minW={adjusted ? `${minimumWidth}px` : undefined}
              maxW={adjusted ? undefined : "100%"}
              {...elementProps}
            >
              <colgroup>
                {widths.map((width, index) => (
                  <col
                    key={index}
                    style={{ width: width > 0 ? `${width}px` : undefined }}
                  />
                ))}
              </colgroup>
              {children}
            </Table.Root>
          </Box>
          {resize.isSaving && (
            <Text role="status" fontSize="xs" color="fg.muted">
              Saving column widths…
            </Text>
          )}
        </Stack>
      </TableColumnResizeContext.Provider>
    </TableResizeControllerContext.Provider>
  );
};
