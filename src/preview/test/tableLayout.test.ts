import { describe, expect, it } from "vitest";
import { extractTablePositions } from "../models/tableLayout";
import { parseTableLayout } from "../api/tableLayouts";

describe("Markdown table positions", () => {
  it("finds nested tables and ignores pipes in code blocks", () => {
    const markdown =
      "# Title\n\n| A | B |\n| - | - |\n| x | y |\n\n```md\n| Ignored |\n| - |\n```\n\n> | Nested |\n> | - |\n> | value |";
    expect(extractTablePositions(markdown)).toEqual([
      { startLine: 3, endLine: 5, columnCount: 2 },
      { startLine: 12, endLine: 14, columnCount: 1 },
    ]);
  });
});

describe("table layout validation", () => {
  const layout = {
    id: "table",
    startLine: 1,
    endLine: 3,
    columnCount: 3,
    columnWidths: [100, 0, 200],
  };
  it("preserves automatic and manual widths", () => {
    expect(parseTableLayout(layout)).toEqual(layout);
  });
  it.each([[63], [-1], [Infinity], [2001], [100, 200, 300, 400]])(
    "rejects invalid widths %j",
    (...columnWidths) => {
      expect(() => parseTableLayout({ ...layout, columnWidths })).toThrow(
        "Invalid table layout response.",
      );
    },
  );
});
