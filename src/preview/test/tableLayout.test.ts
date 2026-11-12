import { previewClient } from "../api/connect";
import { create } from "@bufbuild/protobuf";
import {
  GetTableLayoutsResponseSchema,
  TableLayoutSchema,
} from "../gen/sadoku/preview/v1/preview_pb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTablePositions } from "../models/tableLayout";
import { loadTableLayouts, toTableLayout } from "../api/tableLayouts";

afterEach(() => vi.restoreAllMocks());

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
    expect(toTableLayout(create(TableLayoutSchema, layout))).toEqual(layout);
  });
  it.each([[63], [-1], [Infinity], [2001], [100, 200, 300, 400]])(
    "rejects invalid widths %j",
    (...columnWidths) => {
      expect(() =>
        toTableLayout(create(TableLayoutSchema, { ...layout, columnWidths })),
      ).toThrow("Invalid table layout response.");
    },
  );
});

describe("table layout correspondence", () => {
  const position = { startLine: 1, endLine: 3, columnCount: 3 };
  const message = { ...position, id: "table", columnWidths: [100] };

  it("converts matching generated responses", async () => {
    vi.spyOn(previewClient, "getTableLayouts").mockResolvedValue(
      create(GetTableLayoutsResponseSchema, { tables: [message] }),
    );
    await expect(loadTableLayouts(1, "markdown", [position])).resolves.toEqual([
      message,
    ]);
  });

  it.each([{ startLine: 2 }, { endLine: 4 }, { columnCount: 2 }])(
    "rejects mismatched positions %j",
    async (changed) => {
      vi.spyOn(previewClient, "getTableLayouts").mockResolvedValue(
        create(GetTableLayoutsResponseSchema, {
          tables: [{ ...message, ...changed }],
        }),
      );
      await expect(loadTableLayouts(1, "markdown", [position])).rejects.toThrow(
        "Table layouts do not match the displayed document.",
      );
    },
  );

  it("rejects missing tables and duplicate identities", async () => {
    const second = { ...position, startLine: 5, endLine: 7 };
    vi.spyOn(previewClient, "getTableLayouts")
      .mockResolvedValueOnce(create(GetTableLayoutsResponseSchema))
      .mockResolvedValueOnce(
        create(GetTableLayoutsResponseSchema, {
          tables: [message, { ...message, ...second }],
        }),
      );
    await expect(loadTableLayouts(1, "markdown", [position])).rejects.toThrow(
      "Table layouts do not match the displayed document.",
    );
    await expect(
      loadTableLayouts(1, "markdown", [position, second]),
    ).rejects.toThrow("Table layouts do not match the displayed document.");
  });

  it("rejects default protobuf fields that do not describe a usable table", () => {
    expect(() => toTableLayout(create(TableLayoutSchema))).toThrow(
      "Invalid table layout response.",
    );
  });
});
