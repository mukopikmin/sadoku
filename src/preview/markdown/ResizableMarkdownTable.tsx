import { Box, IconButton, Stack, Table, Text } from "@chakra-ui/react";
import { RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import { Tooltip } from "../components/ui/tooltip";
import { MarkdownBlockActionsContext } from "./MarkdownBlockActionsContext";
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

export const StaticMarkdownTable = ({ elementProps, children }: Props) => (
  <Box maxW="100%" overflowX="auto" py="2" w="fit-content">
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
  elementProps,
  children,
}: Props & {
  layout: TableLayout;
  save: (id: string, widths: number[]) => Promise<TableLayout>;
}) => {
  const resize = useTableColumnResize(layout, save);
  const blockActionsElement = useContext(MarkdownBlockActionsContext);
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
  return (
    <TableColumnResizeContext.Provider value={resize}>
      {blockActionsElement &&
        createPortal(
          <Tooltip content="Reset column widths">
            <IconButton
              aria-label="Reset column widths"
              size="xs"
              variant="outline"
              bg="canvas"
              borderColor="border"
              color="fg.muted"
              disabled={!adjusted}
              onClick={resize.reset}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
            </IconButton>
          </Tooltip>,
          blockActionsElement,
        )}
      <Stack gap="1" py="2" minW="0" maxW="100%">
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
            w={adjusted ? (allAdjusted ? `${minimumWidth}px` : "100%") : "auto"}
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
        {resize.state.status === "saving" && (
          <Text role="status" fontSize="xs" color="fg.muted">
            Saving column widths…
          </Text>
        )}
      </Stack>
    </TableColumnResizeContext.Provider>
  );
};
