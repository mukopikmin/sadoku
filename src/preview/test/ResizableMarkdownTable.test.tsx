import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { TableLayoutContext } from "../markdown/tableLayoutContext";
import type { TableLayout } from "../models/tableLayout";
import {
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./testUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

const markdown = "| A | B | C |\n| - | - | - |\n| x | y | z |";
const layout: TableLayout = {
  id: "table",
  startLine: 1,
  endLine: 3,
  columnCount: 3,
  columnWidths: [100, 200, 300],
};

describe("resizable Markdown table", () => {
  it("restores widths and wires accessible keyboard resizing and reset without selecting comments", async () => {
    const saved = vi.fn();
    const Preview = () => {
      const [tables, setTables] = useState([layout]);
      return (
        <TableLayoutContext.Provider
          value={{
            state: { status: "ready", tables },
            retry: vi.fn(),
            save: async (id, columnWidths) => {
              saved(id, columnWidths);
              const next = { ...layout, columnWidths };
              setTables([next]);
              return next;
            },
          }}
        >
          <MarkdownPreview
            actions={createCommentActions()}
            comments={[]}
            markdown={markdown}
            showHtmlComments
            theme="default"
          />
        </TableLayoutContext.Provider>
      );
    };
    const { container } = render(<Preview />);
    expect(
      [...container.querySelectorAll("col")].map((col) => col.style.width),
    ).toEqual(["100px", "200px", "300px"]);
    const handle = screen.getByRole("separator", { name: "Resize column 2" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    await waitFor(() =>
      expect(saved).toHaveBeenLastCalledWith("table", [100, 210, 300]),
    );
    await waitFor(() =>
      expect(container.querySelectorAll("col")[1].style.width).toBe("210px"),
    );
    fireEvent.click(handle);
    expect(container.querySelector(".commentable-block-selected")).toBeNull();
    fireEvent.click(screen.getByRole("table"));
    expect(
      container
        .querySelector(".comment-line-gutter")
        ?.contains(screen.getByRole("button", { name: "Reset column widths" })),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Reset column widths" }),
    );
    await waitFor(() => expect(saved).toHaveBeenLastCalledWith("table", []));
    await waitFor(() =>
      expect(
        [...container.querySelectorAll("col")].every(
          (col) => col.style.width === "",
        ),
      ).toBe(true),
    );
    expect(
      screen
        .getByRole("button", { name: "Reset column widths" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
