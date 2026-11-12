import {
  maximumColumnWidth,
  minimumColumnWidth,
  type TableLayout,
  type TablePosition,
} from "../models/tableLayout";
import { previewClient } from "./connect";

export const parseTableLayout = (value: TableLayout): TableLayout => {
  if (
    typeof value.id !== "string" ||
    !value.id ||
    !Number.isSafeInteger(value.startLine) ||
    value.startLine < 1 ||
    !Number.isSafeInteger(value.endLine) ||
    value.endLine <= value.startLine ||
    !Number.isSafeInteger(value.columnCount) ||
    value.columnCount < 1 ||
    value.columnCount > 1000 ||
    !Array.isArray(value.columnWidths) ||
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
  const layouts = response.tables.map(parseTableLayout);
  if (
    layouts.length !== tables.length ||
    new Set(layouts.map((layout) => layout.id)).size !== layouts.length ||
    layouts.some((layout, index) =>
      (Object.keys(tables[index]) as (keyof TablePosition)[]).some(
        (key) => layout[key] !== tables[index][key],
      ),
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
  parseTableLayout(
    await previewClient.updateTableLayout({
      documentId: BigInt(documentId),
      displayedMarkdown,
      tableId,
      columnWidths,
    }),
  );
