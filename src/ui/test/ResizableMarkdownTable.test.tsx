import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { TableLayoutContext } from "../markdown/tableLayoutContext";
import type { TableLayout } from "../models/tableLayout";
import {
  cleanup,
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./testUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(cleanup);

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
    fireEvent.click(screen.getByRole("cell", { name: "x" }));
    await screen.findByLabelText("Reset column widths");
    expect(
      document
        .querySelector(".comment-line-gutter")
        ?.contains(screen.getByLabelText("Reset column widths")),
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Reset column widths"));
    await waitFor(() => expect(saved).toHaveBeenLastCalledWith("table", []));
    await waitFor(() =>
      expect(
        [...container.querySelectorAll("col")].every(
          (col) => col.style.width === "",
        ),
      ).toBe(true),
    );
    expect(
      screen.getByLabelText("Reset column widths").hasAttribute("disabled"),
    ).toBe(true);
  });
  it("shows save failures in a toast and retries from the notification", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockImplementation(async (_id, columnWidths) => ({
        ...layout,
        columnWidths,
      }));
    const { container } = render(
      <TableLayoutContext.Provider
        value={{
          state: { status: "ready", tables: [layout] },
          save,
        }}
      >
        <MarkdownPreview
          actions={createCommentActions()}
          comments={[]}
          markdown={markdown}
          showHtmlComments
          theme="default"
        />
      </TableLayoutContext.Provider>,
    );
    fireEvent.keyDown(
      screen.getByRole("separator", { name: "Resize column 1" }),
      { key: "ArrowRight" },
    );
    await screen.findByText("Could not save column widths");
    expect(container.textContent).not.toContain("Could not save column widths");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("table", [110, 200, 300]);
  });
  it("keeps reset beside the comment action for a table inside a quote", async () => {
    const save = vi.fn(async (_id, columnWidths) => ({
      ...layout,
      columnWidths,
    }));
    const quoted = markdown
      .split("\n")
      .map((line) => "> " + line)
      .join("\n");
    render(
      <TableLayoutContext.Provider
        value={{ state: { status: "ready", tables: [layout] }, save }}
      >
        <MarkdownPreview
          actions={createCommentActions()}
          comments={[]}
          markdown={quoted}
          showHtmlComments
          theme="default"
        />
      </TableLayoutContext.Provider>,
    );
    fireEvent.click(screen.getByRole("cell", { name: "x" }));
    const reset = await screen.findByLabelText("Reset column widths");
    expect(
      document.querySelector(".comment-line-gutter")?.contains(reset),
    ).toBe(true);
    fireEvent.click(reset);
    await waitFor(() => expect(save).toHaveBeenCalledWith("table", []));
  });
});
