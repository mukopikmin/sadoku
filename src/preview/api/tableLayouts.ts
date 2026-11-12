import { Code, ConnectError } from "@connectrpc/connect";
import type { TableLayout as TableLayoutMessage } from "../gen/sadoku/preview/v1/preview_pb";
import {
  maximumColumnWidth,
  minimumColumnWidth,
  type TableLayout,
  type TablePosition,
} from "../models/tableLayout";
import { previewClient } from "./connect";

export const toTableLayout = (value: TableLayoutMessage): TableLayout => {
  if (
    !value.id ||
    value.startLine < 1 ||
    value.endLine <= value.startLine ||
    value.columnCount < 1 ||
    value.columnCount > 1000 ||
    value.columnWidths.length > value.columnCount ||
    value.columnWidths.some(
      (width) =>
        !Number.isFinite(width) ||
        (width !== 0 &&
          (width < minimumColumnWidth || width > maximumColumnWidth)),
    )
  ) {
    throw new Error("Invalid table layout response.");
  }
  return {
    id: value.id,
    startLine: value.startLine,
    endLine: value.endLine,
    columnCount: value.columnCount,
    columnWidths: value.columnWidths,
  };
};

export const loadTableLayouts = async (
  documentId: number,
  displayedMarkdown: string,
  tables: TablePosition[],
): Promise<TableLayout[]> => {
  const response = await previewClient.getTableLayouts({
    documentId: BigInt(documentId),
    displayedMarkdown,
    tables,
  });
  const layouts = response.tables.map(toTableLayout);
  if (
    layouts.length !== tables.length ||
    new Set(layouts.map((layout) => layout.id)).size !== layouts.length ||
    layouts.some(
      (layout, index) =>
        layout.startLine !== tables[index].startLine ||
        layout.endLine !== tables[index].endLine ||
        layout.columnCount !== tables[index].columnCount,
    )
  ) {
    throw new Error("Table layouts do not match the displayed document.");
  }
  return layouts;
};

export const saveTableLayout = async (
  documentId: number,
  displayedMarkdown: string,
  tableId: string,
  columnWidths: number[],
): Promise<TableLayout> =>
  toTableLayout(
    await previewClient.updateTableLayout({
      documentId: BigInt(documentId),
      displayedMarkdown,
      tableId,
      columnWidths,
    }),
  );

export const isTableLayoutConflict = (error: unknown): boolean => {
  const code = ConnectError.from(error).code;
  return code === Code.Aborted || code === Code.NotFound;
};
